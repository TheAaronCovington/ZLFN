// Hybrid document discovery and loading
// Prioritizes API-based documents with file system fallback
// 
// Migration Strategy:
// - Database documents are the primary source (preferred)
// - File-based documents in src/assets/documents serve as fallback
// - File-based documents are only shown if not present in database
// - This ensures backward compatibility while transitioning to database-driven content

import { realAPI } from './realAPI'
import { api as mockAPI } from './zlfnAPI'
import { apiConfig } from './apiConfig'

// File-based document loaders (fallback only)
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
	source?: 'database' | 'file'
	author?: string
	created?: string
	modified?: string
	status?: string
}

export async function getDocumentList(): Promise<DocMeta[]> {
	console.debug('[docs] Getting document list from hybrid sources')
	
	const documents: DocMeta[] = []
	const seenIds = new Set<string>()
	
	// First, try to get documents from the database (API)
	try {
		const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
		if (!token) throw new Error('skip real list: no token')
		const apiResponse = await realAPI.listObjects()
		if (apiResponse.success && apiResponse.data) {
			const databaseDocs = (apiResponse.data as any[]).map((obj: any) => {
				const doc: DocMeta = {
					id: obj.id,
					label: obj.metadata?.title || obj.title || obj.id.replace(/_/g, ' '),
					source: 'database' as const,
					author: obj.metadata?.author,
					created: obj.metadata?.created,
					modified: obj.metadata?.modified,
					status: obj.metadata?.status,
					tags: obj.metadata?.tags || []
				}
				seenIds.add(obj.id)
				return doc
			})
			documents.push(...databaseDocs)
			console.debug('[docs] Loaded documents from database:', databaseDocs.length)
		}
	} catch (error) {
		console.debug('[docs] Failed to load documents from database:', error)
	}
	
	// Then, add file-based documents that aren't already in the database
	const fileEntries = Object.keys(loaders)
	const fileDocs = fileEntries
		.map((path) => {
			const match = path.match(/([^/\\]+)\.md$/)
			const id = match ? match[1] : path
			
			// Skip if we already have this document from the database
			if (seenIds.has(id)) {
				return null
			}
			
			const base: DocMeta = { 
				id, 
				label: id.replace(/_/g, ' '),
				source: 'file' as const
			}
			const cfg = DOC_CONFIG[id]
			return cfg ? { ...base, tags: cfg.tags } : base
		})
		.filter((doc): doc is DocMeta => doc !== null)
	
	documents.push(...fileDocs)
	console.debug('[docs] Loaded documents from files:', fileDocs.length)
	
	// Sort by label and return
	const sortedDocs = documents.sort((a, b) => a.label.localeCompare(b.label))
	console.debug('[docs] Total documents loaded:', sortedDocs.length)
	
	return sortedDocs
}

export async function getDocumentContent(id: string): Promise<string | null> {
        console.debug('[docs] Getting document content for:', id)

        const { useRealBackend } = apiConfig.getConfig()

        let dbError: unknown = null

        // First, try to get content from the database (API) only when authenticated
        if (useRealBackend) {
                try {
                        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
                        if (!token) throw new Error('skip real get: no token')
                        const apiResponse = await realAPI.getObject(id)
                        if (apiResponse.success && apiResponse.data && typeof apiResponse.data.markdownContent === 'string') {
                                console.debug('[docs] Loaded content from database:', id)
                                return apiResponse.data.markdownContent
                        }
                        if (!apiResponse.success) dbError = apiResponse.error
                } catch (error) {
                        dbError = error
                }
        }

        // Next, try the mock store before falling back to files
        try {
                const mockResp = await mockAPI.getObject(id)
                if (mockResp.success && mockResp.data && typeof mockResp.data.markdownContent === 'string') {
                        console.debug('[docs] Loaded content from mock store:', id)
                        return mockResp.data.markdownContent
                }
        } catch {}

        if (dbError) {
                console.debug('[docs] Failed to load content from database:', id, dbError)
        }

        // Fallback to file system
        for (const [path, loader] of Object.entries(loaders)) {
                if (path.endsWith(`/${id}.md`)) {
                        try {
                                const content = await loader()
                                console.debug('[docs] Loaded content from file system:', id)
				return content
			} catch (error) {
				console.debug('[docs] Failed to load content from file system:', id, error)
				return null
			}
		}
	}
	
	console.debug('[docs] Document not found in any source:', id)
	return null
}


