import { RoomConfig } from '../IConfig.ts'
import { AppConfig } from '../config.ts'
import { Recorder } from './recorder.ts'
import { DanmakuReceiver } from './danmaku_receiver.ts'
import { printLog, isStreaming } from '../utils/mod.ts'
import { sleep } from '../utils/sleep.ts'
import { RECORD_EVENT_CODE } from './recorder.ts'

class Room {
	private recorder: Recorder
	private isRecording = false
	private isStreaming = false
	private danmakuReceiver: DanmakuReceiver
	private room: RoomConfig

	constructor(config: RoomConfig) {
		this.room = config
		this.danmakuReceiver = new DanmakuReceiver(
			config.realRoomId,
			AppConfig.credential,
		)
		this.recorder = new Recorder(
			config.realRoomId,
			`${AppConfig.output}${config.name}-${config.displayRoomId}`,
			config.allowFallback
		)
		this.recorder.addEventListener(
			RECORD_EVENT_CODE.CHECK_LIVE_STATE,
			async () => {
				await sleep(1000)
				const streaming = await isStreaming(this.room.realRoomId)
				if (streaming) {
					this.recorder.start()
				} else {
					this.recorder.stop()
				}
			},
		)
		this.recorder.addEventListener(RECORD_EVENT_CODE.RECORD_START, () => {
			this.isRecording = true
			printLog(`房间 ${config.displayRoomId} 开始录制`)
		})
		this.danmakuReceiver.addEventListener('LIVE', async () => {
			printLog(`房间 ${config.displayRoomId} 开始直播`)
			if (this.room.autoRecord) {
				await this.recorder.start()
			}
			this.isStreaming = true
		})
		this.danmakuReceiver.addEventListener('PREPARING', async () => {
			await this.recorder.stop()
			printLog(`房间 ${config.displayRoomId} 直播结束`)
			this.isStreaming = false
		})
		this.danmakuReceiver.addEventListener('closed', async () => {
			await sleep(1000)
			await this.danmakuReceiver.connect()
			const streaming = await isStreaming(this.room.realRoomId)
			if (streaming) {
				await this.recorder.start()
				this.isStreaming = true
			} else {
				await this.recorder.stop()
				this.isStreaming = false
			}
		})
		isStreaming(this.room.realRoomId).then((isStreaming) => {
			this.isStreaming = isStreaming
			if (isStreaming && this.room.autoRecord) {
				this.recorder.start()
			}
		})
		this.danmakuReceiver.connect()
	}
	public async restartRecorder() {
		if (this.isStreaming) {
			await this.recorder.stop()
			await this.recorder.start()
		}
	}
	public async stopRecorder() {
		await this.recorder.stop()
	}
	public async startRecorder() {
		if (this.isStreaming) {
			await this.recorder.start()
		}
	}
	public getStreaming() {
		return this.isStreaming
	}
	public getRecording() {
		return this.recorder.getRecordingState()
	}
	public async destroyRoom() {
		await this.recorder.stop()
		this.danmakuReceiver.close()
	}
	public getStreamerName() {
		return this.room.name
	}
	public getAutoRecord() {
		return this.room.autoRecord
	}
	public setAutoRecord(bool: boolean) {
		this.room.autoRecord = bool
	}
	public setRecorderAllowFallback(val: boolean) {
		this.recorder.setAllowFallback(val)
		this.room.allowFallback = val
	}
	public getAllowFallback() {
		return this.room.allowFallback
	}
}

const roomMap = new Map<number, Room>()

export async function initRoomRecorder(config: RoomConfig) {
	await Deno.mkdir(
		`${AppConfig.output}${config.name}-${config.displayRoomId}`,
		{ recursive: true },
	)
	if (!roomMap.has(config.displayRoomId))
		roomMap.set(config.displayRoomId, new Room(config))
}

export function deRoomRecorder(displayRoomId: number) {
	if (roomMap.has(displayRoomId)) {
		const room = roomMap.get(displayRoomId)
		room?.destroyRoom()
		removeRoomFromMap(displayRoomId)
	}
}

export function getLivingStatus(room: number): boolean {
	if (roomMap.has(room)) {
		return roomMap.get(room)!.getStreaming()
	}
	return false
}

export function getRecordingStatus(room: number): boolean {
	if (roomMap.has(room)) {
		return roomMap.get(room)!.getRecording()
	}
	return false
}

export function removeRoomFromMap(room: number): boolean {
	return roomMap.delete(room)
}

export function getRoom(roomId: number): Room | undefined {
	return roomMap.get(roomId)
}

export function getAllRoom(): Array<{
	room: number
	streamer: string
	isRecording: boolean
	isLiving: boolean
	autoRecord: boolean
	allowFallback: boolean
}> {
	const result: Array<{
		room: number
		streamer: string
		isRecording: boolean
		isLiving: boolean
		autoRecord: boolean
		allowFallback: boolean
	}> = []
	for (const roomId of roomMap.keys()) {
		const room = roomMap.get(roomId) as Room
		const isRecording = room.getRecording()
		const isLiving = room.getStreaming()
		const streamer = room.getStreamerName()
		const autoRecord = room.getAutoRecord()
		const allowFallback = room.getAllowFallback()
		result.push({
			room: roomId,
			streamer,
			isLiving,
			isRecording,
			autoRecord,
			allowFallback
		})
	}
	result.sort((a, b) => {
		return a.room - b.room
	})
	return result
}
