export type ExportPayload = {
	expression: string
	ast?: any
	graph?: { nodes: any[]; edges: any[] }
	viewMode?: 'graph' | 'ast' | 'both'
	selectedNodeId?: string | null
	layout?: Record<string, { x: number; y: number }>
	pins?: string[]
	recents?: string[]
}

export function downloadJson(payload: ExportPayload, filename = 'logic-export.json') {
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	a.click()
	URL.revokeObjectURL(url)
}

export async function readJsonFile(file: File): Promise<any> {
	const text = await file.text()
	return JSON.parse(text)
}

export function readSavedLayout(storageKey?: string | null): Record<string, { x: number; y: number }> | null {
	if (!storageKey) return null
	try { return JSON.parse(localStorage.getItem(`xv_layout_${storageKey}`) || 'null') } catch { return null }
}
