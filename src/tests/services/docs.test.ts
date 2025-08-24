import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getDocumentList, getDocumentContent } from '../../services/docs'
import type { DocMeta } from '../../services/docs'

// Mock the realAPI
const mockRealAPI = {
  listObjects: vi.fn(),
  getObject: vi.fn()
}

vi.mock('../../services/realAPI', () => ({
  realAPI: mockRealAPI
}))

// Mock the file system loaders
const mockLoaders = {
  '../assets/documents/test.md': vi.fn(),
  '../assets/documents/guide.md': vi.fn(),
  '../assets/documents/demo.md': vi.fn()
}

vi.mock('../../services/docs', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    // We'll test the actual functions, but mock the file loaders
  }
})

// Mock import.meta.glob
Object.defineProperty(import.meta, 'glob', {
  value: vi.fn(() => mockLoaders),
  writable: true
})

const mockDatabaseObjects = [
  {
    id: 'db-doc-1',
    title: 'Database Document 1',
    markdownContent: '# Database Document 1\n\nContent from database.',
    metadata: {
      title: 'Database Document 1',
      author: 'Test Author',
      created: '2025-01-01T00:00:00Z',
      modified: '2025-01-02T00:00:00Z',
      status: 'published',
      tags: ['database', 'test']
    }
  },
  {
    id: 'db-doc-2',
    markdownContent: '# Database Document 2\n\nAnother database document.',
    metadata: {
      author: 'Another Author',
      created: '2025-01-03T00:00:00Z',
      modified: '2025-01-04T00:00:00Z',
      status: 'draft'
    }
  },
  {
    id: 'shared-id', // This ID also exists in file system
    title: 'Database Version',
    markdownContent: '# Database Version\n\nThis should take precedence.',
    metadata: {
      title: 'Database Version',
      author: 'DB Author',
      created: '2025-01-05T00:00:00Z',
      modified: '2025-01-06T00:00:00Z'
    }
  }
]

describe('docs service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default file loader responses
    mockLoaders['../assets/documents/test.md'].mockResolvedValue('# Test File\n\nFile content.')
    mockLoaders['../assets/documents/guide.md'].mockResolvedValue('# Guide File\n\nGuide content.')
    mockLoaders['../assets/documents/demo.md'].mockResolvedValue('# Demo File\n\nDemo content.')
    mockLoaders['../assets/documents/shared-id.md'] = vi.fn().mockResolvedValue('# File Version\n\nThis should be overridden.')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getDocumentList', () => {
    it('should return database documents with rich metadata', async () => {
      mockRealAPI.listObjects.mockResolvedValue({
        success: true,
        data: mockDatabaseObjects
      })

      const result = await getDocumentList()

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'db-doc-1',
            label: 'Database Document 1',
            source: 'database',
            author: 'Test Author',
            created: '2025-01-01T00:00:00Z',
            modified: '2025-01-02T00:00:00Z',
            status: 'published',
            tags: ['database', 'test']
          }),
          expect.objectContaining({
            id: 'db-doc-2',
            label: 'db doc 2', // Generated from ID
            source: 'database',
            author: 'Another Author',
            created: '2025-01-03T00:00:00Z',
            modified: '2025-01-04T00:00:00Z',
            status: 'draft'
          })
        ])
      )
    })

    it('should include file-based documents when not in database', async () => {
      mockRealAPI.listObjects.mockResolvedValue({
        success: true,
        data: [] // No database documents
      })

      const result = await getDocumentList()

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'test',
            label: 'test',
            source: 'file'
          }),
          expect.objectContaining({
            id: 'guide',
            label: 'guide',
            source: 'file'
          }),
          expect.objectContaining({
            id: 'demo',
            label: 'demo',
            source: 'file'
          })
        ])
      )
    })

    it('should prioritize database documents over file documents with same ID', async () => {
      mockRealAPI.listObjects.mockResolvedValue({
        success: true,
        data: [mockDatabaseObjects[2]] // Only the shared-id document
      })

      const result = await getDocumentList()

      // Should contain database version, not file version
      const sharedDoc = result.find(doc => doc.id === 'shared-id')
      expect(sharedDoc).toEqual(
        expect.objectContaining({
          id: 'shared-id',
          label: 'Database Version',
          source: 'database',
          author: 'DB Author'
        })
      )

      // Should not contain file version of same ID
      const fileDocs = result.filter(doc => doc.source === 'file' && doc.id === 'shared-id')
      expect(fileDocs).toHaveLength(0)
    })

    it('should handle database API failure gracefully', async () => {
      mockRealAPI.listObjects.mockRejectedValue(new Error('API Error'))

      const result = await getDocumentList()

      // Should still return file-based documents
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'test',
            source: 'file'
          }),
          expect.objectContaining({
            id: 'guide',
            source: 'file'
          })
        ])
      )
    })

    it('should handle empty database response', async () => {
      mockRealAPI.listObjects.mockResolvedValue({
        success: false,
        data: null
      })

      const result = await getDocumentList()

      // Should return file-based documents
      expect(result.length).toBeGreaterThan(0)
      expect(result.every(doc => doc.source === 'file')).toBe(true)
    })

    it('should sort documents by label', async () => {
      mockRealAPI.listObjects.mockResolvedValue({
        success: true,
        data: [
          { id: 'zebra', metadata: { title: 'Zebra Document' } },
          { id: 'alpha', metadata: { title: 'Alpha Document' } },
          { id: 'beta', metadata: { title: 'Beta Document' } }
        ]
      })

      const result = await getDocumentList()

      const labels = result.map(doc => doc.label)
      const sortedLabels = [...labels].sort()
      expect(labels).toEqual(sortedLabels)
    })

    it('should handle documents with missing metadata gracefully', async () => {
      mockRealAPI.listObjects.mockResolvedValue({
        success: true,
        data: [
          { id: 'minimal-doc' }, // No metadata
          { id: 'partial-doc', metadata: {} } // Empty metadata
        ]
      })

      const result = await getDocumentList()

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'minimal-doc',
            label: 'minimal doc', // Generated from ID
            source: 'database'
          }),
          expect.objectContaining({
            id: 'partial-doc',
            label: 'partial doc', // Generated from ID
            source: 'database'
          })
        ])
      )
    })
  })

  describe('getDocumentContent', () => {
    it('should return database content when available', async () => {
      mockRealAPI.getObject.mockResolvedValue({
        success: true,
        data: {
          id: 'db-doc-1',
          markdownContent: '# Database Content\n\nFrom database.'
        }
      })

      const result = await getDocumentContent('db-doc-1')

      expect(result).toBe('# Database Content\n\nFrom database.')
      expect(mockRealAPI.getObject).toHaveBeenCalledWith('db-doc-1')
    })

    it('should fallback to file system when database content not available', async () => {
      mockRealAPI.getObject.mockResolvedValue({
        success: false,
        data: null,
        error: 'Not found'
      })

      const result = await getDocumentContent('test')

      expect(result).toBe('# Test File\n\nFile content.')
      expect(mockLoaders['../assets/documents/test.md']).toHaveBeenCalled()
    })

    it('should prioritize database over file system for same ID', async () => {
      mockRealAPI.getObject.mockResolvedValue({
        success: true,
        data: {
          id: 'shared-id',
          markdownContent: '# Database Version\n\nDatabase content.'
        }
      })

      const result = await getDocumentContent('shared-id')

      expect(result).toBe('# Database Version\n\nDatabase content.')
      // File loader should not be called
      expect(mockLoaders['../assets/documents/shared-id.md']).not.toHaveBeenCalled()
    })

    it('should handle database API errors gracefully', async () => {
      mockRealAPI.getObject.mockRejectedValue(new Error('Network error'))

      const result = await getDocumentContent('test')

      // Should fallback to file system
      expect(result).toBe('# Test File\n\nFile content.')
      expect(mockLoaders['../assets/documents/test.md']).toHaveBeenCalled()
    })

    it('should return null when content not found in either source', async () => {
      mockRealAPI.getObject.mockResolvedValue({
        success: false,
        data: null
      })

      const result = await getDocumentContent('non-existent')

      expect(result).toBeNull()
    })

    it('should handle file loading errors', async () => {
      mockRealAPI.getObject.mockResolvedValue({
        success: false,
        data: null
      })

      mockLoaders['../assets/documents/test.md'].mockRejectedValue(new Error('File read error'))

      const result = await getDocumentContent('test')

      expect(result).toBeNull()
    })

    it('should handle empty database content', async () => {
      mockRealAPI.getObject.mockResolvedValue({
        success: true,
        data: {
          id: 'empty-doc',
          markdownContent: ''
        }
      })

      const result = await getDocumentContent('empty-doc')

      expect(result).toBe('')
    })

    it('should handle database response without markdownContent', async () => {
      mockRealAPI.getObject.mockResolvedValue({
        success: true,
        data: {
          id: 'no-content-doc'
          // No markdownContent field
        }
      })

      const result = await getDocumentContent('no-content-doc')

      // Should fallback to file system
      expect(result).toBe('# Test File\n\nFile content.')
    })
  })

  describe('hybrid functionality', () => {
    it('should demonstrate complete hybrid workflow', async () => {
      // Setup: database has some docs, files have others, one overlaps
      mockRealAPI.listObjects.mockResolvedValue({
        success: true,
        data: [
          {
            id: 'db-only',
            metadata: { title: 'Database Only Doc' },
            markdownContent: '# DB Only\n\nDatabase content.'
          },
          {
            id: 'shared-id',
            metadata: { title: 'Database Version' },
            markdownContent: '# Database Version\n\nDatabase wins.'
          }
        ]
      })

      // Get document list
      const docList = await getDocumentList()

      // Should have database docs, file docs (except shared-id), sorted
      expect(docList).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'db-only',
            label: 'Database Only Doc',
            source: 'database'
          }),
          expect.objectContaining({
            id: 'shared-id',
            label: 'Database Version',
            source: 'database'
          }),
          expect.objectContaining({
            id: 'test',
            source: 'file'
          }),
          expect.objectContaining({
            id: 'guide',
            source: 'file'
          })
        ])
      )

      // Test content loading for each type
      mockRealAPI.getObject
        .mockResolvedValueOnce({
          success: true,
          data: { markdownContent: '# DB Only\n\nDatabase content.' }
        })
        .mockResolvedValueOnce({
          success: true,
          data: { markdownContent: '# Database Version\n\nDatabase wins.' }
        })
        .mockResolvedValueOnce({
          success: false,
          data: null
        })

      // Database-only doc
      const dbContent = await getDocumentContent('db-only')
      expect(dbContent).toBe('# DB Only\n\nDatabase content.')

      // Shared ID (database wins)
      const sharedContent = await getDocumentContent('shared-id')
      expect(sharedContent).toBe('# Database Version\n\nDatabase wins.')

      // File-only doc
      const fileContent = await getDocumentContent('test')
      expect(fileContent).toBe('# Test File\n\nFile content.')
    })

    it('should handle mixed success/failure scenarios', async () => {
      // Database partially available
      mockRealAPI.listObjects.mockResolvedValue({
        success: true,
        data: [{ id: 'db-doc', metadata: { title: 'DB Doc' } }]
      })

      const docList = await getDocumentList()
      expect(docList.length).toBeGreaterThan(1) // DB + file docs

      // Content loading with mixed results
      mockRealAPI.getObject
        .mockResolvedValueOnce({ success: true, data: { markdownContent: 'DB content' } })
        .mockRejectedValueOnce(new Error('Network error'))

      const dbContent = await getDocumentContent('db-doc')
      expect(dbContent).toBe('DB content')

      const fileContent = await getDocumentContent('test')
      expect(fileContent).toBe('# Test File\n\nFile content.')
    })
  })

  describe('performance and caching', () => {
    it('should make minimal API calls', async () => {
      mockRealAPI.listObjects.mockResolvedValue({
        success: true,
        data: mockDatabaseObjects
      })

      await getDocumentList()

      // Should only call listObjects once
      expect(mockRealAPI.listObjects).toHaveBeenCalledTimes(1)
    })

    it('should handle large document lists efficiently', async () => {
      // Create a large number of documents
      const largeDatabaseSet = Array.from({ length: 100 }, (_, i) => ({
        id: `doc-${i}`,
        metadata: { title: `Document ${i}` }
      }))

      mockRealAPI.listObjects.mockResolvedValue({
        success: true,
        data: largeDatabaseSet
      })

      const start = performance.now()
      const result = await getDocumentList()
      const end = performance.now()

      expect(result.length).toBeGreaterThanOrEqual(100)
      expect(end - start).toBeLessThan(1000) // Should complete within 1 second
    })
  })
})
