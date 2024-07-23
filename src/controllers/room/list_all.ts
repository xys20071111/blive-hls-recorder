import { Context } from 'oak'
import { getAllRoom } from '../../recorder/room.ts'

export function getRoomList(ctx: Context) {
	ctx.response.body = {
		code: 0,
		data: getAllRoom(),
	}
}
