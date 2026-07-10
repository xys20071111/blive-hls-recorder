import { encoder } from '@/Text.ts'
import { BliveM3u8Parser } from '@/utils/blive_m3u8_parser.ts'
import { printWarning } from '@/utils/print_log.ts'
import { WorkerPool } from './work_pool.ts'
import { FETCH_STREAM_HEADER } from './stream_url.ts'

const M3U8_HEADER = encoder.encode(
	'#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-START:TIME-OFFSET=0\n#EXT-X-TARGETDURATION:1\n',
)

interface M3u8RecorderContext {
	roomId: number
	streamUrl: string
	outputFileStream: Deno.FsFile
	clipDir: string
	workerPool: WorkerPool
	onCheckLiveState: () => void
}

export async function writeM3u8Header(ctx: M3u8RecorderContext) {
	await ctx.outputFileStream.write(M3U8_HEADER)
}

export function startM3u8Recording(ctx: M3u8RecorderContext): ReturnType<typeof setInterval> {
	let isFirstRequest = true
	const clipList: string[] = []

	return setInterval(async () => {
		if (!ctx.streamUrl) {
			ctx.onCheckLiveState()
			return
		}
		try {
			const m3u8Res = await fetch(ctx.streamUrl, {
				method: 'GET',
				headers: FETCH_STREAM_HEADER,
			})
			let m3u8Text = await m3u8Res.text()
			if (m3u8Text.includes('#EXT-X-STREAM-INF')) {
				const lines = m3u8Text.split('\n')
				const targetUrl = (() => {
					for (const line of lines) {
						if (line.startsWith('https')) {
							return line
						}
					}
					return ''
				})()
				m3u8Text = await (
					await fetch(targetUrl, {
						method: 'GET',
						headers: FETCH_STREAM_HEADER,
					})
				).text()
			}
			const m3u8 = BliveM3u8Parser.parse(m3u8Text)
			// 写文件头
			if (isFirstRequest) {
				if (m3u8.clips && m3u8.clips[0]) {
					isFirstRequest = false
					await ctx.outputFileStream.write(
						encoder.encode(
							`#EXT-X-MEDIA-SEQUENCE:${
								m3u8.clips[0].filename.replace('.m4s', '')
							}\n`,
						),
					)
					await ctx.outputFileStream.write(
						encoder.encode(
							`#EXT-X-MAP:URI="${ctx.clipDir}${m3u8.mapFile}"\n`,
						),
					)
					ctx.workerPool.dispatchJob({
						url: ctx.streamUrl.replace('index.m3u8', m3u8.mapFile),
						path: `${ctx.clipDir}${m3u8.mapFile}`,
						headers: FETCH_STREAM_HEADER,
					})
				} else {
					printWarning(`房间${ctx.roomId} 异常的初始m3u8`)
					printWarning(m3u8Text)
				}
			}
			// 下载片段
			for (const item of m3u8.clips) {
				if (item.filename && !clipList.includes(item.filename)) {
					clipList.push(item.filename)
					await ctx.outputFileStream.write(
						encoder.encode(
							`${item.info}\n${ctx.clipDir}${item.filename}\n`,
						),
					)
					ctx.workerPool.dispatchJob({
						url: ctx.streamUrl.replace('index.m3u8', item.filename),
						path: `${ctx.clipDir}${item.filename}`,
						headers: FETCH_STREAM_HEADER,
					})
				}
			}
		} catch (err) {
			const error = err as Error
			printWarning(`房间${ctx.roomId} ${err}`)
			printWarning(error.stack)
			ctx.onCheckLiveState()
		}
	}, 3500)
}
