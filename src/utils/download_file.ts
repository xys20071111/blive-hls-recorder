import { printError } from "./print_log.ts"

// deno-lint-ignore-file no-explicit-any
export async function downloadFile(urlString: string, dest: string, headers: Record<string, string>, retryCount = 0) {
    if (retryCount && retryCount > 5) {
        printError(`${urlString} 失败次数过多，放弃下载`)
        return
    }
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
    } catch {
        printError(`${urlString} 下载失败, 重试`)
        await downloadFile(urlString, dest, headers, retryCount + 1)
    }
}