import { RoomConfig } from '../IConfig.ts'
import { AppConfig } from '../config.ts'
import { Recorder } from './recorder.ts'
import { DanmakuReceiver } from './danmaku_receiver.ts'
import { printLog, request } from '../utils/mod.ts'
import { RoomInfo } from '../IMsg.ts'

class Room {
    private recorder?: Recorder
    private isRecording = false
    private isLiving = false
    private danmakuReceiver: DanmakuReceiver
    private room: RoomConfig

    constructor(config: RoomConfig) {
        this.room = config
        this.danmakuReceiver = new DanmakuReceiver(config.realRoomId, AppConfig.credential)
        this.recorder = new Recorder(config.realRoomId, `${AppConfig.output}${config.name}-${config.displayRoomId}`)
        this.recorder.on('RecordStop', () => {
            this.isRecording = false
            setTimeout(() => {
                this.isStreaming().then((isStreaming) => {
                    if (isStreaming) {
                        this.recorder?.start()
                        this.isRecording = true
                    } else {
                        printLog(`房间 ${config.displayRoomId} 录制结束`)
                        this.recorder?.stop()
                        this.isLiving = false
                    }
                })
            }, 1000)
        })
        this.recorder.on('RecordStart', () => {
            if (this.isRecording) {
                return
            }
            this.isRecording = true
            this.recorder?.start()
            printLog(`房间 ${config.displayRoomId} 开始录制`)
        })
        this.danmakuReceiver.on('LIVE', () => {
            if (!this.isLiving) {
                this.recorder?.start()
                printLog(`房间 ${config.displayRoomId} 开始直播`)
                this.isLiving = true
            }
        })
        this.danmakuReceiver.on('PREPARING', () => {
            printLog(`房间 ${config.displayRoomId} 直播结束`)
            this.recorder?.stop()
            this.isLiving = false
        })
        this.danmakuReceiver.on('closed', () => {
            this.isStreaming().then((isStreaming) => {
                if (isStreaming) {
                    this.recorder?.start()
                    this.isLiving = true
                } else {
                    this.recorder?.stop()
                    this.isLiving = false
                }
            })
            this.danmakuReceiver.connect()
        })
        this.isStreaming().then((isStreaming) => {
            if (isStreaming) {
                this.recorder?.start()
            }
        })
        this.danmakuReceiver.connect()
    }
    public async restartRecorder() {
        await this.recorder?.stop()
        await this.recorder?.start()
    }
    private async isStreaming() {
        const data = await request('/room/v1/Room/room_init', 'GET', {
            id: this.room.displayRoomId
        })
        const roomInfo: RoomInfo = data.data as RoomInfo
        if (roomInfo.live_status === 1) {
            return true
        } else {
            return false
        }
    }
    public getLiving() {
        return this.isLiving
    }
    public getRecording() {
        return this.isRecording
    }
    public destroyRoom() {
        this.recorder?.stop()
        this.danmakuReceiver.removeAllListeners('LIVE')
        this.danmakuReceiver.removeAllListeners('PREPARING')
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