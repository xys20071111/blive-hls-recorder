import { ProgramConfig } from "./IConfig.ts"
import { decoder } from "./Text.ts"

export const AppConfig: ProgramConfig = JSON.parse(decoder.decode(await Deno.readFile(Deno.args[0])))