import { database } from '../db.ts'
import { Context } from '../deps.ts'
import { RoomConfig } from '../IConfig.ts'
import { BroadcasterInfoRoot, RoomInfo } from '../IMsg.ts'
import { initRoomRecorder, getLivingStatus, getRecordingStatus } from '../recorder/room.ts'
import { filterInt, request } from '../utils/mod.ts'

export async function addRoom(ctx: Context) {
	const query = ctx.request.url.searchParams
	const roomIdString = query.get('roomId')
	if (!roomIdString) {
		ctx.response.body = {
			code: 1,
			msg: '需要房间号'
		}
		return
	}
	const displayRoomId = filterInt(roomIdString)
	if (isNaN(displayRoomId)) {
		ctx.response.body = {
			code: 1,
			msg: '房间号错误'
		}
		return
	}
	try {
		const data = await request('/room/v1/Room/room_init', 'GET', {
			id: displayRoomId
		})
		if (data.code !== 0) {
			ctx.response.body = {
				code: 1,
				msg: `房间 ${roomIdString} 不存在`
			}
			return
		}
		const roomInfo: RoomInfo = data.data as RoomInfo
		const roomConfigRes = await request('/live_user/v1/Master/info', 'GET', {
			uid: roomInfo.uid
		})
		const info = (roomConfigRes.data as BroadcasterInfoRoot).info
		const config: RoomConfig = {
			name: info.uname,
			realRoomId: roomInfo.room_id,
			displayRoomId
		}
		await database.set(['room', displayRoomId], config)
		initRoomRecorder(config)
	} catch (e) {
		ctx.response.body = {
			code: 1,
			msg: e
		}
	}
}

export async function delRoom(ctx: Context) {
	const query = ctx.request.url.searchParams
	const room = filterInt(query.get('roomId'))
	if (isNaN(room)) {
		ctx.response.body = {
			code: 1,
			data: '房间号格式错误'
		}
		return
	}
	await database.delete(['room', room])
	ctx.response.body = {
		code: 0,
		data: ''
	}
}

export function getRoomStatus(ctx: Context) {
	const query = ctx.request.url.searchParams
	const roomIdString = query.get('roomId')
	const room = filterInt(roomIdString)
	if (isNaN(room)) {
		ctx.response.body = {
			code: 1,
			data: '房间号格式错误'
		}
		return
	}
	ctx.response.body = {
		code: 0,
		data: {
			isLiving: getLivingStatus(room),
			isRecording: getRecordingStatus(room)
		}
	}
}