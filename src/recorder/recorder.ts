/* eslint-disable @typescript-eslint/no-empty-function */
import { EventEmitter } from '../deps.ts'
import { request, getTimeString, BliveM3u8Parser, printWarning, printLog, isStreaming } from '../utils/mod.ts'
import { AppConfig } from '../config.ts'
import { encoder } from '../Text.ts'
import { FETCH_STREAM_HEADER, LIVE_DIDN_START, FAILED_TO_GET_STREAM_URL } from './constants.ts'
import { WorkerPool } from './work_pool.ts'
import { sleep } from '../utils/sleep.ts'

export class Recorder extends EventEmitter {
	private roomId: number
	private outputPath: string
	private clipDir?: string
	private outputFileStream?: Deno.FsFile
	private clipList: Array<string> = []
	private isFirstRequest = true
	private recordInterval = -1
	private isRecording = false
	private workerPool: WorkerPool = new WorkerPool(AppConfig.workerCount)

	constructor(roomId: number, outputPath: string) {
		super()
		this.roomId = roomId
		this.outputPath = outputPath
	}
	public async stop() {
		clearInterval(this.recordInterval)
		this.recordInterval = -1
		await this.outputFileStream?.write(encoder.encode('#EXT-X-ENDLIST'))
		this.outputFileStream?.close()
		this.outputFileStream = undefined
		this.clipList = []
		this.isFirstRequest = true
		this.emit('RecordStop')
	}

	private async createFileStream() {
		const title = (await request('/xlive/web-room/v1/index/getRoomBaseInfo', 'GET', {
			room_ids: this.roomId,
			req_biz: 'BiLive'
		}))['data']['by_room_ids'][this.roomId.toString()].title
		const outputFile = `${this.outputPath}/${getTimeString()}-${title}.m3u8`
		this.outputFileStream = await Deno.create(outputFile)
		printLog(`房间${this.roomId} 创建新文件 ${outputFile}`)
		this.clipDir = outputFile.replace('.m3u8', '/')
		await Deno.mkdir(this.clipDir, { recursive: true })
	}

	// 获取直播流网址
	private async getStreamUrl(): Promise<string> {
		const data = (await request('/xlive/web-room/v2/index/getRoomPlayInfo', 'GET', {
			room_id: this.roomId,
			no_playurl: 0,
			mask: 1,
			qn: 10000,
			platform: 'web',
			protocol: '1',
			format: '2',
			codec: '0',
			panorama: '1'
		})).data
		if (data.live_status !== 1) {
			throw new Error(LIVE_DIDN_START)
		}
		const host = data.playurl_info.playurl.stream[0].format[0].codec[0].url_info[0].host
		const extra = data.playurl_info.playurl.stream[0].format[0].codec[0].url_info[0].extra
		const path = data.playurl_info.playurl.stream[0].format[0].codec[0].base_url
		if (host && extra && path) {
			return `${host}${path}${extra}`
		}
		throw new Error(FAILED_TO_GET_STREAM_URL)
		// 处理直播流信息

	}

	public async start() {
		if (this.isRecording) {
			return
		}
		this.isRecording = true
		// 创建新文件
		await this.createFileStream()
		await this.outputFileStream!.write(encoder.encode('#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-START:TIME-OFFSET=0\n#EXT-X-TARGETDURATION:1\n'))
		// 获取直播流
		let streamUrl: string
		while (await isStreaming(this.roomId)) {
			try {
				streamUrl = await this.getStreamUrl()
				break
			} catch (e) {
				const err: Error = e
				printWarning(`房间 ${this.roomId}`)
				printWarning(err.stack)
				await sleep(1000)
			}
		}
		// 开始下载流
		this.recordInterval = setInterval(async () => {
			try {
				const m3u8Res = await fetch(streamUrl, {
					method: 'GET',
					headers: {
						'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
						'Referer': 'https://live.bilibili.com',
						'Origin': 'https://live.bilibili.com'
					}
				})
				const m3u8 = BliveM3u8Parser.parse(await m3u8Res.text())
				// 写文件头
				if (this.isFirstRequest) {
					this.isFirstRequest = false
					await this.outputFileStream?.write(encoder.encode(`#EXT-X-MEDIA-SEQUENCE:${m3u8.clips[0].filename.replace('.m4s', '')}\n`))
					await this.outputFileStream?.write(encoder.encode(`#EXT-X-MAP:URI="${this.clipDir}${m3u8.mapFile}"\n`))
					this.workerPool.dispatchJob({
						url: streamUrl.replace('index.m3u8', m3u8.mapFile),
						path: `${this.clipDir}${m3u8.mapFile}`,
						headers: FETCH_STREAM_HEADER
					})
				}
				// 下载片段
				for (const item of m3u8.clips) {
					if (item.filename && !this.clipList.includes(item.filename)) {
						this.clipList.push(item.filename)
						await this.outputFileStream!.write(encoder.encode(`${item.info}\n${this.clipDir}${item.filename}\n`))
						this.workerPool.dispatchJob({
							url: streamUrl.replace('index.m3u8', item.filename),
							path: `${this.clipDir}${item.filename}`,
							headers: FETCH_STREAM_HEADER
						})
					}
				}
			} catch (err) {
				printWarning(`房间${this.roomId} ${err}`)
				this.emit('CheckLiveStatus')
			}
		}, 3500)
	}
}
