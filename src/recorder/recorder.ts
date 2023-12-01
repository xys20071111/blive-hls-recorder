/* eslint-disable @typescript-eslint/no-empty-function */
import { EventEmitter } from '../deps.ts'
import { request, getTimeString, BliveM3u8Parser, printWarning, printLog, printError, InvalidM3u8Error } from '../utils/mod.ts'
import { AppConfig } from '../config.ts'
import { encoder } from '../Text.ts'

const workerPool: Array<Worker> = []
for (let i = 0; i < AppConfig.workerCount; i++) {
	const worker = new Worker(import.meta.resolve('./download_worker.ts'), { type: 'module' })
	workerPool.push(worker)
}

export class Recorder extends EventEmitter {
	private roomId: number
	private outputPath: string
	private clipDir?: string
	private outputFileStream?: Deno.FsFile
	private clipList: Array<string> = []
	private isFirstRequest = true
	private recordInterval = -1

	constructor(roomId: number, outputPath: string) {
		super()
		this.roomId = roomId
		this.outputPath = outputPath
	}
	public stop() {
		if (this.recordInterval !== -1) {
			clearInterval(this.recordInterval)
			this.recordInterval = -1
			this.outputFileStream?.write(encoder.encode('#EXT-X-ENDLIST')).then(() => {
				this.outputFileStream?.close()
				this.outputFileStream = undefined
				this.clipList = []
				this.isFirstRequest = true
				this.emit('RecordStop')
			})
		}
	}
	public async createFileStream() {
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
	async getStreamUrl(): Promise<string> {
		try {
			const data = (await request('/xlive/web-room/v2/index/getRoomPlayInfo', 'GET', {
				room_id: this.roomId,
				no_playurl: 0,
				mask: 1,
				qn: 10000,
				platform: 'web',
				protocol: '0,1',
				format: '0,1,2',
				codec: '0,1',
				panorama: '1'
			})).data
			// 处理直播流信息
			for (const streamInfo of data.playurl_info.playurl.stream) {
				// 找出hls流
				if (streamInfo.protocol_name === 'http_hls') {
					for (const streamItem of streamInfo.format) {
						if (streamItem.format_name === 'fmp4' && streamItem.codec[0]['current_qn'] === 10000) {
							const streamHost = streamItem.codec[0].url_info[0].host
							const streamParma = streamItem.codec[0].url_info[0].extra
							const streamPath = streamItem.codec[0].base_url
							return `${streamHost}${streamPath}${streamParma}`
						}
					}
				}
			}
			throw new Error('未找到直播流')
		} catch (err) {
			printError(`房间${this.roomId} ${err}`)
			return ''
		}
	}

	async start() {
		if (this.recordInterval !== -1) {
			return
		}
		const streamUrl = await this.getStreamUrl()
		if (!streamUrl || streamUrl.length < 10) {
			this.emit('RecordStop')
			return
		}
		// 创建新文件
		await this.createFileStream()
		await this.outputFileStream!.write(encoder.encode('#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-START:TIME-OFFSET=0\n#EXT-X-TARGETDURATION:1\n'))
		// 开始下载流
		this.recordInterval = setInterval(async () => {
			let counter = 0
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
				if (this.isFirstRequest) {
					// 写文件头
					this.isFirstRequest = false
					await this.outputFileStream?.write(encoder.encode(`#EXT-X-MEDIA-SEQUENCE:${m3u8.clips[0].filename.replace('.m4s', '')}\n`))
					await this.outputFileStream?.write(encoder.encode(`#EXT-X-MAP:URI="${this.clipDir}${m3u8.mapFile}"\n`))
					workerPool[0].postMessage({
						url: streamUrl.replace('index.m3u8', m3u8.mapFile),
						path: `${this.clipDir}${m3u8.mapFile}`,
						heders: {
							'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
							'Referer': 'https://live.bilibili.com',
							'Origin': 'https://live.bilibili.com',
						}
					})
				}

				for (const item of m3u8.clips) {
					// 下载片段
					if (item.filename && !this.clipList.includes(item.filename)) {
						this.clipList.push(item.filename)
						await this.outputFileStream!.write(encoder.encode(`${item.info}\n${this.clipDir}${item.filename}\n`))
						workerPool[counter % AppConfig.workerCount].postMessage({
							url: streamUrl.replace('index.m3u8', item.filename),
							path: `${this.clipDir}${item.filename}`,
							heders: {
								'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
								'Referer': 'https://live.bilibili.com',
								'Origin': 'https://live.bilibili.com',
							}
						})
						counter++
					}
				}
			} catch (err) {
				printWarning(`房间${this.roomId} ${err}`)
				if (err instanceof InvalidM3u8Error) {
					this.emit('RecordStop')
				}
			}
		}, 3500)
	}
}
