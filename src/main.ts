import { app } from './app.ts'
import { RoomConfig } from './IConfig.ts'
import { AppConfig } from './config.ts'
import { database } from './db.ts'
import { printLog } from '@/utils/print_log.ts'
import { initRoomRecorder } from './recorder/room.ts'

const rooms: Deno.KvListIterator<RoomConfig> = database.list({
	prefix: ['room'],
})
for await (const item of rooms) {
	printLog(`初始化房间${item.value.displayRoomId}`)
	let needsUpdate = false
	if (item.value.autoRecord === undefined) {
		item.value.autoRecord = true
		needsUpdate = true
	}
	if (item.value.allowFallback === undefined) {
		item.value.allowFallback = false
		needsUpdate = true
	}
	if (needsUpdate) {
		await database.set(['room', item.value.displayRoomId], item.value)
	}
	try {
		await initRoomRecorder(item.value)
	} catch (e) {
		printLog(`初始化房间 ${item.value.displayRoomId} 失败：${e}`)
	}
}

// deno-lint-ignore no-explicit-any
app.addEventListener('listen', (event: any) => {
	console.log(`Listening on port ${event.port}`)
})

app.listen({
	port: AppConfig.port,
})
