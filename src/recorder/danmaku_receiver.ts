import * as brotli from 'brotli'
import { Credential } from '../IConfig.ts'
import { printLog } from '../utils/mod.ts'
import { sign } from "../utils/wbi_util.ts"
import { AppConfig } from "../config.ts"

enum DANMAKU_PROTOCOL {
	JSON = 0,
	HEARTBEAT,
	ZIP,
	BROTLI,
}

enum DANMAKU_TYPE {
	HEARTBEAT = 2,
	HEARTBEAT_REPLY = 3,
	DATA = 5,
	AUTH = 7,
	AUTH_REPLY = 8,
}

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8')

export class DanmakuReceiver extends EventTarget {
	private roomId: number
	private ws: WebSocket | null = null
	private credential: Credential
	private resetTimer: number = -1
	constructor(roomId: number, credential: Credential) {
		super()
		this.roomId = roomId
		this.credential = credential
	}
	public async connect() {
		try {
			const signed = await sign(this.credential, {
				id: this.roomId,
				type: 0
			})
			console.log(`https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo?${signed}`)
			//获取房间信息
			const roomConfig = await (
				await fetch(
					`https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo?${signed}`,
					{
						headers: {
							Cookie: `buvid3=${this.credential.buvid3};SESSDATA=${this.credential.sessdata};bili_jct=${this.credential.csrf};`,
							'User-Agent': AppConfig.ua,
							Host: 'api.live.bilibili.com',
							Origin: 'https://live.bilibili.com',
							Referer: `https://live.bilibili.com/${this.roomId}`,
						},
					},
				)
			).json()
			// 检查获取到的信息是否正常
			if (!roomConfig.data) {
				console.log(roomConfig)
				this.dispatchEvent(
					new CustomEvent('closed', { detail: '房间数据异常' }),
				)
				return
			}
			this.ws = new WebSocket(
				`wss://${roomConfig.data.host_list[0].host}:${roomConfig.data.host_list[0].wss_port}/sub`,
			)
			this.ws.onopen = () => {
				// 如果10秒内没有通过验证
				this.resetTimer = setInterval(() => {
					//就关闭连接
					this.close()
				}, 10000)
				const payload = JSON.stringify({
					roomid: this.roomId,
					protover: 3,
					platform: 'web',
					uid: this.credential.uid,
					buvid: this.credential.buvid3,
					key: roomConfig.data.token,
					type: 2,
				})
				this.ws!.onmessage = this.packetProcesser.bind(this)
				if (this.ws && this.ws.readyState === WebSocket.OPEN) {
					this.ws!.send(this.generatePacket(1, 7, payload))
				}
			}
			this.ws.onclose = () => {
				this.dispatchEvent(
					new CustomEvent('closed', { detail: '连接断开' }),
				)
			}
		} catch {
			this.dispatchEvent(
				new CustomEvent('closed', { detail: 'fetch房间信息失败' }),
			)
		}
	}
	private generatePacket(
		protocol: number,
		type: number,
		payload: string,
	): ArrayBuffer {
		const payloadEncoded = encoder.encode(payload)
		const packetLength = 16 + payloadEncoded.length
		const packet = new ArrayBuffer(packetLength)
		const packetArray = new Uint8Array(packet)
		const packetView = new DataView(packet)
		packetView.setInt32(0, packetLength) // 总长度
		packetView.setInt16(4, 16) // 头长度
		packetView.setUint16(6, protocol) // 协议类型
		packetView.setUint32(8, type) // 包类型
		packetView.setUint32(12, 1) // 一个常数
		packetArray.set(payloadEncoded, 16) //写入负载
		return packet
	}
	private async packetProcesser(ev: MessageEvent<Blob>) {
		// 弹幕事件处理
		const msgPacket = await ev.data.arrayBuffer()
		const msgArray = new Uint8Array(msgPacket)
		const msg = new DataView(msgPacket)
		const packetProtocol = msg.getInt16(6)
		const packetType = msg.getInt32(8)
		const packetPayload: Uint8Array = msgArray.slice(16)
		switch (packetType) {
			case DANMAKU_TYPE.HEARTBEAT_REPLY:
				// 心跳包，不做处理
				break
			case DANMAKU_TYPE.AUTH_REPLY:
				clearInterval(this.resetTimer)
				printLog(`房间${this.roomId} 弹幕接收器 通过认证`)
				// 认证通过，每30秒发一次心跳包
				setInterval(() => {
					const heartbeatPayload = '陈睿你妈死了'
					if (this.ws && this.ws.readyState == WebSocket.OPEN) {
						this.ws.send(
							this.generatePacket(1, 2, heartbeatPayload),
						)
					}
				}, 30000)
				this.dispatchEvent(new Event('connected'))
				break
			case DANMAKU_TYPE.DATA:
				this.dataProcesser(packetProtocol, packetPayload)
				break
			default:
				printLog(
					`房间${this.roomId} 弹幕接收器 未知的弹幕数据包种类 ${packetType}`,
				)
		}
	}
	private dataProcesser(packetProtocol: number, packetPayload: Uint8Array) {
		switch (packetProtocol) {
			case DANMAKU_PROTOCOL.JSON: {
				// 这些数据大都没用，但还是留着吧
				const jsonData = JSON.parse(decoder.decode(packetPayload))
				this.dispatchEvent(
					new CustomEvent(jsonData.cmd, { detail: jsonData.data }),
				)
				break
			}
			case DANMAKU_PROTOCOL.BROTLI:
				this.payloadProcesser(packetPayload)
		}
	}
	private payloadProcesser(packetPayload: Uint8Array) {
		const resultRaw = brotli.decompress(packetPayload)
		const result = new DataView(resultRaw.buffer)
		let offset = 0
		while (offset < resultRaw.length) {
			const length = result.getUint32(offset)
			const packetData = resultRaw.slice(offset + 16, offset + length)
			const data = JSON.parse(decoder.decode(packetData))
			const cmd = data.cmd.split(':')[0]
			this.dispatchEvent(
				new CustomEvent(cmd, {
					detail: { room: this.roomId, data: data.info || data.data },
				}),
			)
			offset += length
		}
	}
	close() {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.onclose = () => { }
			this.ws.close()
			this.ws = null
			this.dispatchEvent(
				new CustomEvent('closed', { detail: '手动断开' }),
			)
		}
	}
}
