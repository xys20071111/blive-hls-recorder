import { Application, Router } from 'oak'
import { addRoom, delRoom } from './controllers/room/add_and_remove.ts'
import { getRoomStatus } from './controllers/room/status.ts'
import { restartRecorder } from './controllers/room/recorder_controller.ts'
import { getRoomList } from "./controllers/room/list_all.ts"

const app = new Application()
const router = new Router()

router.get('/api/addRoom', addRoom)
router.get('/api/delRoom', delRoom)
router.get('/api/getRoomStatus', getRoomStatus)
router.get('/api/restartRecorder', restartRecorder)
router.get('/api/getRoomList', getRoomList)

app.use(router.allowedMethods())
app.use(router.routes())

export { app }