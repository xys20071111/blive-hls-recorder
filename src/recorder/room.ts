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
    private isLiving = false
    private danmakuReceiver: DanmakuReceiver
    private room: RoomConfig

    constructor(config: RoomConfig) {
        this.room = config
        this.danmakuReceiver = new DanmakuReceiver(config.realRoomId, AppConfig.credential)
        this.recorder = new Recorder(config.realRoomId, `${AppConfig.output}${config.name}-${config.displayRoomId}`)
        this.recorder.addEventListener(RECORD_EVENT_CODE.CHECK_LIVE_STATE, async () => {
            await sleep(1000)
            const streaming = await isStreaming(this.room.realRoomId)
            if (streaming) {
                this.recorder.start()
            } else {
                this.recorder.stop()
            }
        })
        this.recorder.addEventListener(RECORD_EVENT_CODE.RECORD_START, () => {
            this.isRecording = true
            printLog(`房间 ${config.displayRoomId} 开始录制`)
        })
        this.danmakuReceiver.addEventListener('LIVE', async () => {
            await this.recorder.start()
            printLog(`房间 ${config.displayRoomId} 开始直播`)
            this.isLiving = true
        })
        this.danmakuReceiver.addEventListener('PREPARING', async () => {
            await this.recorder.stop()
            printLog(`房间 ${config.displayRoomId} 直播结束`)
            this.isLiving = false
        })
        this.danmakuReceiver.addEventListener('closed', async () => {
            await this.danmakuReceiver.connect()
            const streaming = await isStreaming(this.room.realRoomId)
            if (streaming) {
                await this.recorder.start()
                this.isLiving = true
            } else {
                await this.recorder.stop()
                this.isLiving = false
            }
        })
        isStreaming(this.room.realRoomId).then((isStreaming) => {
            if (isStreaming) {
                this.recorder.start()
            }
        })
        this.danmakuReceiver.connect()
    }
    public async restartRecorder() {
        await this.recorder.stop()
        await this.recorder.start()
    }
    public getLiving() {
        return this.isLiving
    }
    public getRecording() {
        return this.recorder.getRecordingState()
    }
    public async destroyRoom() {
        await this.recorder.stop()
        await this.danmakuReceiver.close()
    }
    public getStreamerName() {
        return this.room.name
    }
}

const roomMap = new Map<number, Room>()

export async function initRoomRecorder(config: RoomConfig) {
    await Deno.mkdir(`${AppConfig.output}${config.name}-${config.displayRoomId}`, { recursive: true })
    if (!roomMap.has(config.displayRoomId))
        roomMap.set(config.displayRoomId, new Room(config))
}

export function getLivingStatus(room: number): boolean {
    if (roomMap.has(room)) {
        return roomMap.get(room)!.getLiving()
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
}> {
    const result: Array<{
        room: number
        streamer: string
        isRecording: boolean
        isLiving: boolean
    }> = []
    for (const roomId of roomMap.keys()) {
        const room = roomMap.get(roomId) as Room
        const isRecording = room.getRecording()
        const isLiving = room.getLiving()
        const streamer = room.getStreamerName()
        result.push({
            room: roomId,
            streamer,
            isLiving,
            isRecording
        })
    }
    return result
}