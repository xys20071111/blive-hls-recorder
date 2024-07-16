import { request } from './requester.ts'
import { RoomInfo } from '../IMsg.ts'

export async function isStreaming(id: number) {
    const data = await request('/xlive/web-room/v2/index/getRoomPlayInfo', 'GET', {
        room_id: id,
        no_playurl: 1
    })
    if (!data) {
        return false
    }
    const roomInfo: RoomInfo = data.data as RoomInfo
    if (roomInfo.live_status === 1) {
        return true
    } else {
        return false
    }
}