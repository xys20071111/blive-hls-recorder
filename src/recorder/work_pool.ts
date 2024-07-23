interface Task {
	url: string
	path: string
	headers: Record<string, string>
}

export class WorkerPool {
	private workerPool: Array<Worker> = []
	private counter = 0
	constructor(count: number) {
		for (let i = 0; i < count; i++) {
			const worker = new Worker(
				import.meta.resolve('./download_worker.ts'),
				{
					type: 'module',
				},
			)
			this.workerPool.push(worker)
		}
	}
	public dispatchJob(job: Task) {
		this.workerPool[this.counter % this.workerPool.length].postMessage(job)
		this.counter++
	}
}
