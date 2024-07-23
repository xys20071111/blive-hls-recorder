import { AppConfig } from '../config.ts'
import { printError } from './print_log.ts'

// deno-lint-ignore-file no-explicit-any
export async function downloadFile(
	urlString: string,
	dest: string,
	headers: Record<string, string>,
) {
	if (urlString.length === 0) {
		return
	}
	for (let i = 0; i < AppConfig.downloadRetry; i++) {
		try {
			const destStream = await Deno.create(dest)
			const url = new URL(urlString)
			const req = await fetch(url, { headers })
			if (req.status !== 200) {
				throw new Error(`${urlString} 下载失败, 错误码 ${req.status}`)
			}
			if (req.body) {
				req.body.pipeTo(destStream.writable)
			}
			break
		} catch (e) {
			const err: Error = e
			printError(err.message)
			printError(`重试次数 ${i}`)
			printError(`${err.stack}`)
		}
	}
}
