/* eslint-disable @typescript-eslint/no-empty-function */
import { encoder } from '@/Text.ts'
import { AppConfig } from '@/config.ts'
import { WorkerPool } from './work_pool.ts'
import { sleep } from '@/utils/sleep.ts'
import { isStreaming } from '@/utils/is_streaming.ts'
import { printWarning } from '@/utils/print_log.ts'
import { getStreamUrl } from './stream_url.ts'
import { createFileStream } from './file_stream.ts'
import { writeM3u8Header, startM3u8Recording } from './m3u8_recorder.ts'
import { recordFlvStream } from './flv_recorder.ts'

export enum RECORD_EVENT_CODE {
	RECORD_START = 'RECORD_START',
	RECORD_STOP = 'RECORD_STOP',
	CHECK_LIVE_STATE = 'CHECK_LIVE_STATE',
}

export class Recorder extends EventTarget {
	private roomId: number
	private streamUrl?: string
	private outputPath: string
	private clipDir?: string
	private outputFileStream?: Deno.FsFile
	private recordInterval?: ReturnType<typeof setInterval>
	private isRecording = false
	private workerPool: WorkerPool = new WorkerPool(AppConfig.workerCount)
	private outputFilePath?: string
	private allowFallback: boolean

	constructor(roomId: number, outputPath: string, allowFallback: boolean) {
		super()
		this.roomId = roomId
		this.outputPath = outputPath
		this.allowFallback = allowFallback
	}

	public getRecordingState(): boolean {
		return this.isRecording
	}

	public getAllowFallback() {
		return this.allowFallback
	}

	public setAllowFallback(val: boolean) {
		this.allowFallback = val
	}

	public async stop() {
		if (this.recordInterval !== undefined) {
			clearInterval(this.recordInterval)
			this.recordInterval = undefined
		}
		if (this.outputFileStream) {
			await this.outputFileStream.write(encoder.encode('#EXT-X-ENDLIST'))
			this.outputFileStream.close()
			this.outputFileStream = undefined
		}
		this.isRecording = false
		this.dispatchEvent(new Event(RECORD_EVENT_CODE.RECORD_STOP))
	}

	private checkLiveState() {
		this.dispatchEvent(new Event(RECORD_EVENT_CODE.CHECK_LIVE_STATE))
	}

	public async start() {
		if (this.isRecording) {
			return
		}
		await this.stop()
		this.isRecording = true
		// 获取直播流
		while (await isStreaming(this.roomId)) {
			try {
				this.streamUrl = await getStreamUrl(
					this.roomId,
					this.allowFallback,
				)
				break
			} catch (e) {
				const err: Error = e as Error
				printWarning(`房间 ${this.roomId}`)
				printWarning(err.stack)
			}
			await sleep(30000)
		}
		// 创建新文件
		const extension = this.streamUrl?.includes('.m3u8') ? 'm3u8' : 'flv'
		try {
			const fileResult = await createFileStream(
				this.roomId,
				this.outputPath,
				extension,
			)
			this.outputFilePath = fileResult.outputFilePath
			this.outputFileStream = fileResult.outputFileStream
			this.clipDir = fileResult.clipDir
		} catch {
			this.checkLiveState()
			return
		}

		if (extension === 'm3u8') {
			await writeM3u8Header({
				roomId: this.roomId,
				streamUrl: this.streamUrl!,
				outputFileStream: this.outputFileStream,
				clipDir: this.clipDir!,
				workerPool: this.workerPool,
				onCheckLiveState: () => this.checkLiveState(),
			})
			this.recordInterval = startM3u8Recording({
				roomId: this.roomId,
				streamUrl: this.streamUrl!,
				outputFileStream: this.outputFileStream,
				clipDir: this.clipDir!,
				workerPool: this.workerPool,
				onCheckLiveState: () => this.checkLiveState(),
			})
		} else {
			await recordFlvStream({
				roomId: this.roomId,
				streamUrl: this.streamUrl!,
				outputFileStream: this.outputFileStream,
				onCheckLiveState: () => this.checkLiveState(),
			})
			await this.stop()
			this.checkLiveState()
		}
	}
}
