import { Credential } from "../IConfig.ts"
import { crypto } from '@std/crypto'

const MIXIN_KEY_ENC_TAB: Array<number> = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
]
const encoder = new TextEncoder()

async function getRawKey(credential: Credential): Promise<string | null> {
    const navReq = await fetch('https://api.bilibili.com/x/web-interface/nav', {
        headers: {
            Cookie: `buvid3=${credential.buvid3};SESSDATA=${credential.sessdata};bili_jct=${credential.csrf};`,
            "User-Agent":
                "Mozilla/5.0 (X11 Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36",
            Host: "api.live.bilibili.com",
            Origin: "https://live.bilibili.com",
            Referer: `https://live.bilibili.com/101?broadcast_type=0`,
        }
    })
    const navInfo = (await navReq.json())['data']
    if (navInfo['wbi_img']) {
        const imgKey = navInfo['wbi_img'].img_url.split("/").pop().split('.')[0]
        const subKey = navInfo['wbi_img'].sub_url.split("/").pop().split('.')[0]
        return imgKey + subKey
    } else {
        return null
    }
}

export async function getKey(credential: Credential): Promise<string | null> {
    const keyPart = await getRawKey(credential)
    if (keyPart) {
        const key = MIXIN_KEY_ENC_TAB.map(index => keyPart[index])
        return key.join('').slice(0, 32)
    } else {
        return null
    }
}

function toHex(buffer: ArrayBuffer) {
    const hashArray = Array.from(new Uint8Array(buffer))                     // convert buffer to byte array
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('') // convert bytes to hex string
    return hashHex
}

export async function sign(credential: Credential, content: { [key: string]: string | number }) {
    const wts = Math.round(Date.now() / 1000)
    const key = await getKey(credential)
    Object.assign(content, { wts })
    const query = Object.keys(content).sort().map(index => `${encodeURIComponent(index)}=${encodeURIComponent(content[index])}`).join('&')
    return query + `&w_rid=${toHex(await crypto.subtle.digest('MD5', encoder.encode(query + key)))}`
}
