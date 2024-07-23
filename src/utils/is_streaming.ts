import { request } from './requester.ts'
import { RoomInfo } from '../IMsg.ts'
import { printWarning } from './mod.ts'

export async function isStreaming(id: number) {
    const data = await request('/room/v1/Room/room_init', 'GET', { id })
    if (!data) {
        printWarning('警告：请求结果没有数据，请手动检查是否被风控')
        return false
    }
    const roomInfo: RoomInfo = data.data as RoomInfo
    if (roomInfo.live_status === 1) {
        return true
    } else {
        return false
    }
}