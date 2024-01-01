import { AppConfig } from '../config.ts'
import { printError } from './print_log.ts'

// deno-lint-ignore-file no-explicit-any
export async function downloadFile(urlString: string, dest: string, headers: Record<string, string>) {
    for (let i = 0; i < AppConfig.downloadRetry; i++) {
        try {
            const destStream = await Deno.create(dest)
            const url = new URL(urlString)
            const req = await fetch(url, { headers })
            const content = await req.arrayBuffer()
            if (content.byteLength === 0) {
                printError('下载内容为空')
                throw new Error('下载内容为空')
            }
            await destStream.write(new Uint8Array(content))
            destStream.close()
            break
        } catch (e) {
            const err: Error = e
            printError(err.stack)
            printError(`${urlString} 下载失败, 重试次数 ${i}`)
        }
    }
}