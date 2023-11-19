import { Application, Router } from './deps.ts'
import { addRoom, delRoom } from './controllers/room.ts'

const app = new Application()
const router = new Router()

router.get('/api/addRoom', addRoom)
router.get('/api/delRoom', delRoom)

app.use(router.allowedMethods())
app.use(router.routes())

export { app }