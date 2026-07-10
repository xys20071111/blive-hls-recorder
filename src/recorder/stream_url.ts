import { request } from '@/utils/requester.ts'
import { AppConfig } from '@/config.ts'

export const FETCH_STREAM_HEADER: HeadersInit = {
	'User-Agent': AppConfig.ua ??
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
	Referer: 'https://live.bilibili.com',
	Origin: 'https://live.bilibili.com',
}

enum ERROR_NAME {
	LIVE_DIDN_START = 'LIVE_DIDN_START',
	FAILED_TO_GET_STREAM_URL = 'FAILED_TO_GET_STREAM_URL',
}

function extractStreamUrl(data: any): string | null {
	if (!data?.playurl_info?.playurl?.stream?.[0]?.format?.[0]?.codec?.[0]) {
		return null
	}
	const codec = data.playurl_info.playurl.stream[0].format[0].codec[0]
	const host = codec.url_info[0]?.host
	const extra = codec.url_info[0]?.extra
	const path = codec.base_url
	if (host && extra && path) {
		return `${host}${path}${extra}`
	}
	return null
}

export async function getStreamUrl(
	roomId: number,
	allowFallback: boolean,
): Promise<string> {
	try {
		const data = (
			await request('/xlive/web-room/v2/index/getRoomPlayInfo', 'GET', {
				room_id: roomId,
				no_playurl: 0,
				mask: 1,
				qn: 10000,
				platform: 'web',
				protocol: '1',
				format: '2',
				codec: '0',
				panorama: '1',
			})
		).data
		if (data.live_status !== 1) {
			throw new Error(ERROR_NAME.LIVE_DIDN_START)
		}
		if (data.playurl_info && data.playurl_info.playurl) {
			const streamUrl = extractStreamUrl(data)
			if (streamUrl) return streamUrl
		}
		if (allowFallback) {
			const fallbackData = (
				await request('/xlive/web-room/v2/index/getRoomPlayInfo', 'GET', {
					room_id: roomId,
					no_playurl: 0,
					mask: 1,
					qn: 10000,
					platform: 'web',
					protocol: '0,1',
					format: '0,1,2',
					codec: '0,1,2',
					panorama: '1',
				})
			).data
			const fallbackUrl = extractStreamUrl(fallbackData)
			if (fallbackUrl) return fallbackUrl
		}
	} catch (e) {
		throw e
	}
	throw new Error(ERROR_NAME.FAILED_TO_GET_STREAM_URL)
}
