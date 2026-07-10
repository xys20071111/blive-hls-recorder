import { printWarning } from '@/utils/print_log.ts'
import { FlvHeader, FlvPacket, FlvStreamParser } from 'node-flv'
import { FETCH_STREAM_HEADER } from './stream_url.ts'

interface FlvRecorderContext {
	roomId: number
	streamUrl: string
	outputFileStream: Deno.FsFile
	onCheckLiveState: () => void
}

export async function recordFlvStream(ctx: FlvRecorderContext): Promise<void> {
	try {
		const flvStream = new FlvStreamParser()
		let isFirstRequest = true
		flvStream.on('flv-header', (header: FlvHeader) => {
			if (isFirstRequest) {
				const buffer = header.build()
				ctx.outputFileStream.write(buffer)
				isFirstRequest = false
			}
		})
		flvStream.on('flv-packet', (packet: FlvPacket) => {
			const buffer = packet.build()
			ctx.outputFileStream.write(buffer)
		})
		const url = new URL(ctx.streamUrl)
		const req = await fetch(url, {
			headers: FETCH_STREAM_HEADER,
		})
		if (req.status !== 200) {
			throw new Error(`${ctx.streamUrl} 下载失败, 错误码 ${req.status}`)
		}
		if (req.body) {
			const reader = req.body.getReader()
			while (true) {
				const data = await reader.read()
				try {
					flvStream.write(data.value!)
				} catch (e) {
					printWarning(`房间${ctx.roomId} FLV 写入错误：${e}`)
					break
				}
				if (data.done) {
					flvStream.destroy()
					break
				}
			}
		}
	} catch (e) {
		printWarning(`房间 ${ctx.roomId} flv下载发生错误`)
		printWarning(e)
	}
}
