export interface ProgramConfig {
	output: string
	port: number
	credential: Credential
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