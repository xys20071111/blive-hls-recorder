function getTimeString(): string {
	const time = new Date()
	const pad = (n: number) => n.toString().padStart(2, '0')
	return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}-${pad(time.getHours())}-${pad(time.getMinutes())}-${pad(time.getSeconds())}`
}

export { getTimeString }
