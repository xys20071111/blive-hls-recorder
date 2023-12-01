import { printError } from "./print_log.ts"

// deno-lint-ignore-file no-explicit-any
export async function downloadFile(urlString: string, dest: string, headers: Record<string, string>) {
    try {
        const destStream = await Deno.create(dest)
        const url = new URL(urlString)
        const req = await fetch(url, { headers })
        const content = await req.arrayBuffer()
        await destStream.write(new Uint8Array(content))
    } catch {
        printError(`${urlString} 下载失败, 重试`)
        await downloadFile(urlString, dest, headers)
    }
}