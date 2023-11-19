import { app } from './app.ts'
import { RoomConfig } from './IConfig.ts'
import { AppConfig } from './config.ts'
import { database } from './db.ts'
import { printLog } from './utils/mod.ts'
import { initRoomRecorder } from './recorder/room.ts'

const rooms: Deno.KvListIterator<RoomConfig> = await database.list({
    prefix: ['room']
})
for await (const item of rooms) {
    printLog(`初始化房间${item.value.displayRoomId}`)
    initRoomRecorder(item.value).then()
}
app.listen({
    port: AppConfig.port
})
app.addEventListener('listen', (event) => {
    console.log(`Listening on port ${event.port}`)
})