import { request } from './requester.ts'
import { RoomInfo } from '../IMsg.ts'
import { printWarning } from './print_log.ts'

export async function isStreaming(id: number) {
	const data = await request('/xlive/web-room/v2/index/getRoomPlayInfo', 'GET', { room_id: id, no_playurl: 1 })
	if (!data) {
		console.log(new Error().stack)
		printWarning(`房间: ${id} 警告：请求结果没有数据，请手动检查是否被风控`)
		return false
	}
	const roomInfo: RoomInfo = data.data as RoomInfo
	if (roomInfo.live_status === 1) {
		return true
	} else {
		return false
	}
}
