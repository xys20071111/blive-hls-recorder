/* eslint-disable @typescript-eslint/no-empty-function */
import {
	request,
	getTimeString,
	BliveM3u8Parser,
	printWarning,
	printLog,
	isStreaming,
	InvalidM3u8Error,
	downloadFileWithoutRetry,
} from '../utils/mod.ts'
import { AppConfig } from '../config.ts'
import { encoder } from '../Text.ts'
import { WorkerPool } from './work_pool.ts'
import { sleep } from '../utils/sleep.ts'

export enum RECORD_EVENT_CODE {
	RECORD_START = 'RECORD_START',
	RECORD_STOP = 'RECORD_STOP',
	CHECK_LIVE_STATE = 'CHECK_LIVE_STATE',
}

const FETCH_STREAM_HEADER = {
	'User-Agent':
		'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
	Referer: 'https://live.bilibili.com',
	Origin: 'https://live.bilibili.com',
}

enum ERROR_NAME {
	LIVE_DIDN_START = 'LIVE_DIDN_START',
	FAILED_TO_GET_STREAM_URL = 'FAILED_TO_GET_STREAM_URL',
}

export class Recorder extends EventTarget {
	private roomId: number
	private streamUrl?: string
	private outputPath: string
	private clipDir?: string
	private outputFileStream?: Deno.FsFile
	private clipList: Array<string> = []
	private isFirstRequest = true
	private recordInterval = -1
	private isRecording = false
	private workerPool: WorkerPool = new WorkerPool(AppConfig.workerCount)
	private outputFilePath?: string


	constructor(roomId: number, outputPath: string) {
		super()
		this.roomId = roomId
		this.outputPath = outputPath
	}
	public getRecordingState(): boolean {
		return this.isRecording
	}
	public async stop() {
		clearInterval(this.recordInterval)
		this.recordInterval = -1
		await this.outputFileStream?.write(encoder.encode('#EXT-X-ENDLIST'))
		this.outputFileStream?.close()
		this.outputFileStream = undefined
		this.clipList = []
		this.isFirstRequest = true
		this.isRecording = false
		this.dispatchEvent(new Event(RECORD_EVENT_CODE.RECORD_STOP))
	}

	private async createFileStream(extension: string) {
		const title = (
			await request('/xlive/web-room/v1/index/getRoomBaseInfo', 'GET', {
				room_ids: this.roomId,
				req_biz: 'BiLive',
			})
		)['data']['by_room_ids'][this.roomId.toString()].title
		this.outputFilePath = `${this.outputPath}/${getTimeString()}-${title}.${extension}`
		if (extension === 'm3u8') {
			this.clipDir = this.outputFilePath.replace('.m3u8', '/')
			await Deno.mkdir(this.clipDir, { recursive: true })
		}
		this.outputFileStream = await Deno.create(this.outputFilePath)
		printLog(`房间${this.roomId} 创建新文件 ${this.outputFilePath}`)
	}

	// 获取直播流网址
	private async getStreamUrl(): Promise<string> {
		// 处理直播流信息
		try {
			const data = (
				await request('/xlive/web-room/v2/index/getRoomPlayInfo', 'GET', {
					room_id: this.roomId,
					no_playurl: 0,
					mask: 1,
					qn: 10000,
					platform: 'web',
					protocol: '1',
					format: '2',
					codec: '0',
					panorama: '1',
				})
			).data
			if (data.live_status !== 1) {
				throw new Error(ERROR_NAME.LIVE_DIDN_START)
			}
			if (data.playurl_info && data.playurl_info.playurl) {
				const host =
					data.playurl_info.playurl.stream[0].format[0].codec[0].url_info[0].host
				const extra =
					data.playurl_info.playurl.stream[0].format[0].codec[0].url_info[0].extra
				const path =
					data.playurl_info.playurl.stream[0].format[0].codec[0].base_url
				if (host && extra && path) {
					return `${host}${path}${extra}`
				}
			} else {
				const data = (
					await request('/xlive/web-room/v2/index/getRoomPlayInfo', 'GET', {
						room_id: this.roomId,
						no_playurl: 0,
						mask: 1,
						qn: 10000,
						platform: 'web',
						protocol: '0,1',
						format: '0,1,2',
						codec: '0,1,2',
						panorama: '1',
					})
				).data
				const host =
					data.playurl_info.playurl.stream[0].format[0].codec[0].url_info[0].host
				const extra =
					data.playurl_info.playurl.stream[0].format[0].codec[0].url_info[0].extra
				const path =
					data.playurl_info.playurl.stream[0].format[0].codec[0].base_url
				if (host && extra && path) {
					return `${host}${path}${extra}`
				}
			}
		} catch (e) {
			throw e
		}
		throw new Error(ERROR_NAME.FAILED_TO_GET_STREAM_URL)
	}

	public async start() {
		if (this.isRecording) {
			return
		}
		this.isRecording = true
		// 获取直播流
		while (await isStreaming(this.roomId)) {
			try {
				this.streamUrl = await this.getStreamUrl()
				break
			} catch (e) {
				const err: Error = e
				printWarning(`房间 ${this.roomId}`)
				printWarning(err.stack)
			}
			await sleep(30000)
		}
		// 创建新文件
		if (this.streamUrl?.includes('.m3u8')) {
			try {
				await this.createFileStream('m3u8')
			} catch {
				this.dispatchEvent(new Event(RECORD_EVENT_CODE.CHECK_LIVE_STATE))
				return
			}
			await this.outputFileStream!.write(
				encoder.encode(
					'#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-START:TIME-OFFSET=0\n#EXT-X-TARGETDURATION:1\n',
				),
			)
			// 开始下载流
			this.recordInterval = setInterval(async () => {
				if (!this.streamUrl) {
					this.dispatchEvent(new Event(RECORD_EVENT_CODE.CHECK_LIVE_STATE))
					return
				}
				try {
					const m3u8Res = await fetch(this.streamUrl, {
						method: 'GET',
						headers: FETCH_STREAM_HEADER,
					})
					let m3u8Text = await m3u8Res.text()
					if (m3u8Text.includes('#EXT-X-STREAM-INF')) {
						const lines = m3u8Text.split('\n')
						const targetUrl = (() => {
							for (const line of lines) {
								if (line.startsWith('https')) {
									return line
								}
							}
							return ''
						})()
						m3u8Text = await (
							await fetch(targetUrl, {
								method: 'GET',
								headers: FETCH_STREAM_HEADER,
							})
						).text()
					}
					const m3u8 = BliveM3u8Parser.parse(m3u8Text)
					// 写文件头
					if (this.isFirstRequest) {
						if (m3u8.clips && m3u8.clips[0]) {
							this.isFirstRequest = false
							await this.outputFileStream?.write(
								encoder.encode(
									`#EXT-X-MEDIA-SEQUENCE:${m3u8.clips[0].filename.replace('.m4s', '')}\n`,
								),
							)
							await this.outputFileStream?.write(
								encoder.encode(
									`#EXT-X-MAP:URI="${this.clipDir}${m3u8.mapFile}"\n`,
								),
							)
							this.workerPool.dispatchJob({
								url: this.streamUrl.replace('index.m3u8', m3u8.mapFile),
								path: `${this.clipDir}${m3u8.mapFile}`,
								headers: FETCH_STREAM_HEADER,
							})
						} else {
							printWarning(`房间${this.roomId} 异常的初始m3u8`)
							printWarning(m3u8Text)
						}
					}
					// 下载片段
					for (const item of m3u8.clips) {
						if (item.filename && !this.clipList.includes(item.filename)) {
							this.clipList.push(item.filename)
							await this.outputFileStream!.write(
								encoder.encode(`${item.info}\n${this.clipDir}${item.filename}\n`),
							)
							this.workerPool.dispatchJob({
								url: this.streamUrl.replace('index.m3u8', item.filename),
								path: `${this.clipDir}${item.filename}`,
								headers: FETCH_STREAM_HEADER,
							})
						}
					}
				} catch (err) {
					const error = err as Error
					printWarning(`房间${this.roomId} ${err}`)
					printWarning(error.stack)
					if (err instanceof InvalidM3u8Error) {
						// 重新获取直播流
						while (await isStreaming(this.roomId)) {
							try {
								this.streamUrl = await this.getStreamUrl()
								break
							} catch (e) {
								const err: Error = e
								printWarning(`房间 ${this.roomId}`)
								printWarning(err.stack)
								await sleep(2000)
							}
						}
					}
					this.dispatchEvent(new Event(RECORD_EVENT_CODE.CHECK_LIVE_STATE))
				}
			}, 3500)
		} else {
			while (await isStreaming(this.roomId)) {
				await this.createFileStream('flv')
				try {
					await downloadFileWithoutRetry(this.streamUrl!, this.outputFilePath!, FETCH_STREAM_HEADER)
				} catch (e) {
					printWarning(`房间 ${this.roomId} flv下载发生错误`)
					printWarning(this.outputFilePath)
					printWarning(e)
				}
			}
		}
	}
}
