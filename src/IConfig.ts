export interface ProgramConfig {
	output: string
	port: number
	credential: Credential
	workerCount: number
	downloadRetry: number
	corsOrigin?: string
	ua: string
}

export interface Credential {
	cookie: string
	uid: number
	accessKey: string
}

export interface RoomConfig {
	name: string
	realRoomId: number
	displayRoomId: number
	autoRecord: boolean
	allowFallback: boolean
}
