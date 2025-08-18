// Vite-powered document discovery and loading
// Dynamically imports markdown files under src/assets/documents

const loaders = import.meta.glob('../assets/documents/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>

type DocConfig = { tags?: string[] }
const DOC_CONFIG: Record<string, DocConfig> = {
	'TAG_Critique': { tags: ['theology', 'analysis'] },
	'logic_demo': { tags: ['logic', 'examples'] },
	'expressions_guide': { tags: ['guide', 'syntax'] },
	'test': { tags: ['misc'] },
}

export type DocMeta = {
	id: string
	label: string
	tags?: string[]
}

export async function getDocumentList(): Promise<DocMeta[]> {
	const entries = Object.keys(loaders)
	return entries
		.map((path) => {
			const match = path.match(/([^/\\]+)\.md$/)
			const id = match ? match[1] : path
			const base = { id, label: id.replace(/_/g, ' ') }
			const cfg = DOC_CONFIG[id]
			return cfg ? { ...base, tags: cfg.tags } : base
		})
		.sort((a, b) => a.label.localeCompare(b.label))
}

export async function getDocumentContent(id: string): Promise<string | null> {
	for (const [path, loader] of Object.entries(loaders)) {
		if (path.endsWith(`/${id}.md`)) {
			try {
				return await loader()
			} catch {
				return null
			}
		}
	}
	return null
}


