import { Context } from 'oak'
import { getLivingStatus, getRecordingStatus } from '../../recorder/room.ts'
import { filterInt } from '../../utils/mod.ts'

export function getRoomStatus(ctx: Context) {
	const query = ctx.request.url.searchParams
	const roomIdString = query.get('roomId')
	const room = filterInt(roomIdString)
	if (isNaN(room)) {
		ctx.response.body = {
			code: 1,
			msg: '房间号格式错误',
		}
		return
	}
	ctx.response.body = {
		code: 0,
		data: {
			isLiving: getLivingStatus(room),
			isRecording: getRecordingStatus(room),
		},
	}
}
