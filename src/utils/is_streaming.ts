import { request } from './requester.ts'
import { RoomInfo } from '../IMsg.ts'

export async function isStreaming(id: number) {
    const data = await request('/room/v1/Room/room_init', 'GET', { id })
    const roomInfo: RoomInfo = data.data as RoomInfo
    if (roomInfo.live_status === 1) {
        return true
    } else {
        return false
    }
}