import { Application, Router } from 'oak'
import { addRoom, delRoom } from './controllers/room/add_and_remove.ts'
import { getRoomStatus } from './controllers/room/status.ts'
import {
	restartRecorder,
	startRecorder,
	stopRecorder,
} from './controllers/room/recorder_controller.ts'
import { getRoomList } from './controllers/room/list_all.ts'
import { setAutoRecord } from './controllers/room/set_auto_record.ts'
import { setAllowFallback } from './controllers/room/set_allow_fallback.ts'
import { AppConfig } from './config.ts'

const app = new Application()
const router = new Router()

router.get('/api/room/add', addRoom)
router.get('/api/room/del', delRoom)
router.get('/api/room/getStatus', getRoomStatus)
router.get('/api/room/restartRecorder', restartRecorder)
router.get('/api/room/stopRecorder', stopRecorder)
router.get('/api/room/startRecorder', startRecorder)
router.get('/api/room/list', getRoomList)
router.get('/api/room/setAutoRecord', setAutoRecord)
router.get('/api/room/setAllowFallback', setAllowFallback)

if (AppConfig.corsOrigin) {
	app.use((ctx, next) => {
		ctx.response.headers.set(
			'Access-Control-Allow-Origin',
			AppConfig.corsOrigin!,
		)
		return next()
	})
}
app.use(router.allowedMethods())
app.use(router.routes())

export { app }
