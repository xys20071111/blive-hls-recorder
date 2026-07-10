import { request } from '@/utils/requester.ts'
import { getTimeString } from '@/utils/time.ts'
import { printLog } from '@/utils/print_log.ts'

export interface FileStreamResult {
	outputFilePath: string
	outputFileStream: Deno.FsFile
	clipDir?: string
}

export async function createFileStream(
	roomId: number,
	outputPath: string,
	extension: string,
): Promise<FileStreamResult> {
	const roomInfo = await request(
		'/xlive/web-room/v1/index/getRoomBaseInfo',
		'GET',
		{
			room_ids: roomId,
			req_biz: 'BiLive',
		},
	)
	const title =
		roomInfo?.data?.by_room_ids?.[roomId.toString()]?.title
	const outputFilePath =
		`${outputPath}/${getTimeString()}-${title}.${extension}`
	let clipDir: string | undefined
	if (extension === 'm3u8') {
		clipDir = outputFilePath.replace('.m3u8', '/')
		await Deno.mkdir(clipDir, { recursive: true })
	}
	const outputFileStream = await Deno.create(outputFilePath)
	printLog(`房间${roomId} 创建新文件 ${outputFilePath}`)
	return { outputFilePath, outputFileStream, clipDir }
}
