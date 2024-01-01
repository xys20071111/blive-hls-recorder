import { database } from '../../db.ts'
import { Context } from '../../deps.ts'
import { RoomConfig } from '../../IConfig.ts'
import { BroadcasterInfoRoot, RoomInfo } from '../../IMsg.ts'
import { initRoomRecorder, getRoom, removeRoomFromMap } from '../../recorder/room.ts'
import { filterInt, request, printLog } from '../../utils/mod.ts'

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
        const existence = await database.get(['room', displayRoomId])
        if (!existence.value) {
            printLog(`添加房间 ${displayRoomId}`)
            await database.set(['room', displayRoomId], config)
            initRoomRecorder(config)
            ctx.response.body = {
                code: 0,
                msg: ''
            }
        } else {
            ctx.response.body = {
                code: 1,
                msg: '房间已存在'
            }
        }
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
            msg: '房间号格式错误'
        }
        return
    }
    printLog(`删除房间 ${room}`)
    await database.delete(['room', room])
    const targetRoom = getRoom(room)
    if (targetRoom) {
        await targetRoom.destroyRoom()
    }
    removeRoomFromMap(room)
    ctx.response.body = {
        code: 0,
        msg: ''
    }
}