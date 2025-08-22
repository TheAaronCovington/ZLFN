import type { AstNodeRec } from './logic'

type PendingRequest = {
	resolve: (value: AstNodeRec | null) => void
	reject: (reason?: unknown) => void
}

let worker: Worker | null = null
let nextId = 1
const pending: Map<number, PendingRequest> = new Map()

function ensureWorker(): Worker {
	if (worker) return worker
	worker = new Worker(new URL('../workers/astWorker.ts', import.meta.url), { type: 'module' })
	worker.onmessage = (e: MessageEvent) => {
		const { reqId, ast, error } = e.data || {}
		const entry = pending.get(reqId)
		if (!entry) return
		pending.delete(reqId)
		if (error) entry.reject(new Error(String(error)))
		else entry.resolve(ast ?? null)
	}
	worker.onerror = (err) => {
		// Reject all pending requests on worker error
		for (const [id, entry] of pending.entries()) {
			entry.reject(err)
			pending.delete(id)
		}
	}
	return worker
}

export function parseAstInWorker(expression: string): Promise<AstNodeRec | null> {
	const w = ensureWorker()
	const reqId = nextId++
	return new Promise<AstNodeRec | null>((resolve, reject) => {
		pending.set(reqId, { resolve, reject })
		w.postMessage({ reqId, expression })
	})
}

export function terminateAstWorker(): void {
	if (worker) {
		worker.terminate()
		worker = null
		pending.clear()
	}
}


