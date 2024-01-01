export interface ProgramConfig {
	output: string
	port: number
	credential: Credential,
	workerCount: number,
	downloadRetry: number
}

export interface Credential {
	sessdata: string
	csrf: string
	buvid3: string
	uid: number
}

export interface RoomConfig {
	name: string
	realRoomId: number
	displayRoomId: number
}