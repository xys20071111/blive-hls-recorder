// deno-lint-ignore-file
import { getTimeString } from './time.ts'

export function printLog(log: any) {
	console.log(`${getTimeString()} ${log}`)
}

export function printWarning(log: any) {
	console.warn(`${getTimeString()} ${log}`)
}

export function printError(log: any) {
	console.error(`${getTimeString()} ${log}`)
}