import { app } from './app.ts'
import { RoomConfig } from './IConfig.ts'
import { AppConfig } from './config.ts'
import { database } from './db.ts'
import { printLog } from './utils/mod.ts'
import { initRoomRecorder } from './recorder/room.ts'

const rooms: Deno.KvListIterator<RoomConfig> = await database.list({
	prefix: ['room'],
})
for await (const item of rooms) {
	printLog(`初始化房间${item.value.displayRoomId}`)
	if (item.value.autoRecord === undefined) {
		item.value.autoRecord = true
		const automic = database.atomic()
		automic.set(['room', item.value.displayRoomId], item.value)
		await automic.commit()
	}
	if (item.value.allowFallback === undefined) {
		item.value.allowFallback = false
		const automic = database.atomic()
		automic.set(['room', item.value.displayRoomId], item.value)
		await automic.commit()
	}
	initRoomRecorder(item.value).then()
}

// deno-lint-ignore no-explicit-any
app.addEventListener('listen', (event: any) => {
	console.log(`Listening on port ${event.port}`)
})

app.listen({
	port: AppConfig.port,
})
