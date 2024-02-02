// deno-lint-ignore-file
import { red, yellow } from 'fmt/colors.ts'
import { getTimeString } from './time.ts'

export function printLog(log: any) {
	console.log(`${getTimeString()} ${log}`)
}

export function printWarning(log: any) {
	console.warn(yellow(`${getTimeString()} ${log}`))
}

export function printError(log: any) {
	console.error(red(`${getTimeString()} ${log}`))
}