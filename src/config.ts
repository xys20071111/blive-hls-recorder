import { ProgramConfig, Credential } from './IConfig.ts'
import { decoder } from './Text.ts'

function validateConfig(config: unknown): ProgramConfig {
	if (typeof config !== 'object' || config === null) {
		throw new Error('配置文件格式错误')
	}
	const c = config as Record<string, unknown>
	if (typeof c.output !== 'string') throw new Error('缺少 output 字段')
	if (typeof c.port !== 'number') throw new Error('缺少 port 字段')
	if (typeof c.workerCount !== 'number') throw new Error('缺少 workerCount 字段')
	if (typeof c.downloadRetry !== 'number') throw new Error('缺少 downloadRetry 字段')
	if (typeof c.credential !== 'object' || c.credential === null) throw new Error('缺少 credential 字段')
	const cred = c.credential as Record<string, unknown>
	if (typeof cred.cookie !== 'string') throw new Error('缺少 credential.cookie 字段')
	if (typeof cred.uid !== 'number') throw new Error('缺少 credential.uid 字段')
	if (typeof cred.accessKey !== 'string') throw new Error('缺少 credential.accessKey 字段')
	return {
		output: c.output as string,
		port: c.port as number,
		workerCount: c.workerCount as number,
		downloadRetry: c.downloadRetry as number,
		ua: (c.ua as string | undefined) ?? 'Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0',
		corsOrigin: c.corsOrigin as string | undefined,
		credential: {
			cookie: cred.cookie as string,
			uid: cred.uid as number,
			accessKey: cred.accessKey as string,
		} as Credential,
	}
}

const configPath = Deno.args[0]
if (!configPath) {
	throw new Error('请提供配置文件路径')
}
export const AppConfig: ProgramConfig = validateConfig(
	JSON.parse(decoder.decode(await Deno.readFile(configPath)))
)
