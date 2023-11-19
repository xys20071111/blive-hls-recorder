/* eslint-disable @typescript-eslint/no-empty-function */
import { EventEmitter } from '../deps.ts'
import { request, getTimeString, downloadFile, BliveM3u8Parser, printWarning, printLog } from '../utils/mod.ts'
import { AppConfig } from '../config.ts'
import { encoder } from '../Text.ts'
import { printError } from '../utils/print_log.ts'

export class Recorder extends EventEmitter {
	private roomId: number
	private outputPath: string
	private clipDir?: string
	private outputFileStream?: Deno.FsFile
	private clipList: Array<string> = []
	private isFirstRequest = true

	constructor(roomId: number, outputPath: string) {
		super()
		this.roomId = roomId
		this.outputPath = outputPath
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
		await Deno.mkdir(this.clipDir)
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
		const streamUrl = await this.getStreamUrl()
		if (!streamUrl || streamUrl.length < 10) {
			this.emit('RecordStop', 1)
			return
		}
		// 创建新文件
		await this.createFileStream()
		this.outputFileStream!.write(encoder.encode('#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-START:TIME-OFFSET=0\n#EXT-X-TARGETDURATION:1\n'))
		// 开始下载流
		const recordInterval = setInterval(async () => {
			try {
				const m3u8Res = await fetch(streamUrl, {
					method: 'GET',
					headers: {
						Cookie: `buvid3=${AppConfig.credential.buvid3}; SESSDATA=${AppConfig.credential.sessdata}; bili_jct=${AppConfig.credential.csrf};`,
						'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
						'Referer': 'https://live.bilibili.com',
						'Origin': 'https://live.bilibili.com'
					}
				})
				if (m3u8Res.status !== 200 && m3u8Res.status !== 206) {
					clearInterval(recordInterval)
					this.outputFileStream?.write(encoder.encode('#EXT-X-ENDLIST'))
					this.outputFileStream?.close()
					this.isFirstRequest = true
					this.emit('RecordStop', 1)
				}
				const m3u8 = BliveM3u8Parser.parse(await m3u8Res.text())
				if (this.isFirstRequest) {
					this.isFirstRequest = false
					this.outputFileStream?.write(encoder.encode(`#EXT-X-MEDIA-SEQUENCE:${m3u8.clips[0].filename.replace('.m4s', '')}\n`))
					this.outputFileStream?.write(encoder.encode(`#EXT-X-MAP:URI="${this.clipDir}${m3u8.mapFile}"\n`))
					downloadFile(streamUrl.replace('index.m3u8', m3u8.mapFile), `${this.clipDir}${m3u8.mapFile}`, {
						'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
						'Referer': 'https://live.bilibili.com',
						'Origin': 'https://live.bilibili.com',
						Cookie: `buvid3=${AppConfig.credential.buvid3}; SESSDATA=${AppConfig.credential.sessdata}; bili_jct=${AppConfig.credential.csrf};`,
					})
				}
				for (const item of m3u8.clips) {
					if (item.filename && !this.clipList.includes(item.filename)) {
						this.clipList.push(item.filename)
						this.outputFileStream!.write(encoder.encode(`${item.info}\n${this.clipDir}${item.filename}\n`))
						downloadFile(streamUrl.replace('index.m3u8', item.filename), `${this.clipDir}${item.filename}`, {
							'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
							'Referer': 'https://live.bilibili.com',
							'Origin': 'https://live.bilibili.com',
							Cookie: `buvid3=${AppConfig.credential.buvid3}; SESSDATA=${AppConfig.credential.sessdata}; bili_jct=${AppConfig.credential.csrf};`,
						})
					}
				}
			} catch (err) {
				printWarning(`房间${this.roomId} ${err}`)
				this.emit('RecordStop', 1)
			}
		}, 3500)
	}
}
