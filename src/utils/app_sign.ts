import { createHash } from 'node:crypto'

type Params = Record<string, any>

const md5 = (str: string) => createHash('md5').update(str).digest('hex')

/**
 * 为请求参数进行 APP 签名
 */
export function appSign(params: Params, appkey: string, appsec: string) {
    params.appkey = appkey
    const searchParams = new URLSearchParams(params)
    searchParams.sort()
    const sign = md5(searchParams.toString() + appsec)
    searchParams.append('sign', sign)
    return searchParams.toString()
}