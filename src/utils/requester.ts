import { AppConfig } from '../config.ts'
import { printError } from './mod.ts'
import { sign } from "./wbi_util.ts"

const GET_HEADER = {
	Cookie: AppConfig.credential.cookie,
	host: 'api.live.bilibili.com',
	Referer: 'https://live.bilibili.com',
}

const POST_HEADER = {
	...GET_HEADER,
	'Content-Type': 'application/json',
}

// deno-lint-ignore no-explicit-any
async function pathBuilder(path: string, data: any): Promise<string> {
	let result = `${path}?`
	result += await sign(AppConfig.credential, data)
	return result
}

async function request(path: string, method: 'GET' | 'POST', data: object) {
	try {
		const query = await pathBuilder(path, data)
		const res = await fetch(
			`https://api.live.bilibili.com${query}`,
			{
				method,
				headers: method === 'POST' ? POST_HEADER : GET_HEADER,
				body: method === 'POST' ? JSON.stringify(data) : undefined,
				cache: 'no-cache',
			},
		)
		if (res.ok) {
			const data = await res.json()
			return data
		}
	} catch (e) {
		printError(e)
	}
}
export { request }
