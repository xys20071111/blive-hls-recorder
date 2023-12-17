import { Context } from '../../deps.ts'
import { getRoom } from '../../recorder/room.ts'
import { filterInt } from '../../utils/mod.ts'

export async function restartRecorder(ctx: Context) {
    const query = ctx.request.url.searchParams
    const roomIdString = query.get('roomId')
    const roomId = filterInt(roomIdString)
    if (isNaN(roomId)) {
        ctx.response.body = {
            code: 1,
            msg: '房间号格式错误'
        }
        return
    }
    const room = getRoom(roomId)
    if (!room) {
        ctx.response.body = {
            code: 1,
            msg: '房间不存在'
        }
        return
    }
    await room?.restartRecorder()
}