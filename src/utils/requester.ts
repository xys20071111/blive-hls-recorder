import { AppConfig } from '../config.ts'
import { printError } from './mod.ts'

const GET_HEADER = {
	Cookie: `buvid3=${AppConfig.credential.buvid3}; SESSDATA=${AppConfig.credential.sessdata}; bili_jct=${AppConfig.credential.csrf};`,
	'user-agent':
		'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
	host: 'api.live.bilibili.com',
	Referer: 'https://live.bilibili.com',
}

const POST_HEADER = {
	...GET_HEADER,
	'Content-Type': 'application/json',
}

// deno-lint-ignore no-explicit-any
function pathBuilder(path: string, data: any): string {
	let result = `${path}?`
	for (const item in data) {
		result += `${item}=${data[item]}&`
	}
	return result
}

async function request(path: string, method: 'GET' | 'POST', data: object) {
	try {
		const res = await fetch(
			`https://api.live.bilibili.com${method === 'POST' ? path : pathBuilder(path, data)}`,
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
		return request(path, method, data)
	}
}
export { request }
