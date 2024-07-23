/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />

import { downloadFile } from '../utils/mod.ts'

interface Task {
    url: string
    path: string
    headers: Record<string, string>
}
const taskPool: Array<Task> = []

self.onmessage = (event) => {
    taskPool.push(event.data)
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

while (true) {
    const task = taskPool.shift()
    if (task) {
        await downloadFile(task.url, task.path, task.headers)
    }
    await sleep(100)
}