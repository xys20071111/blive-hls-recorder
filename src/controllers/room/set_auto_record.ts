import { database } from '../../db.ts'
import { Context } from 'oak'
import { filterInt, printLog } from '../../utils/mod.ts'
import { RoomConfig } from '../../IConfig.ts'
import { getRoom } from '../../recorder/room.ts'

export async function setAutoRecord(ctx: Context) {
    const query = ctx.request.url.searchParams
    const roomIdString = query.get('roomId')
    const autoRecord = query.get('auto') ? true : false
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
    const existence: Deno.KvEntryMaybe<RoomConfig> = await database.get(['room', displayRoomId])
    if (existence.value) {
        printLog(`修改 ${displayRoomId} 的自动录制设置为 ${autoRecord}`)
        existence.value.autoRecord = autoRecord
        await database.set(['room', displayRoomId], existence.value)
        const room = getRoom(displayRoomId)
        room?.setAutoRecord(autoRecord)
        ctx.response.body = {
            code: 0,
            msg: `修改 ${displayRoomId} 的自动录制设置为 ${autoRecord}`
        }
    } else {
        ctx.response.body = {
            code: 1,
            msg: '房间不存在'
        }
    }
}