import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { realAPI } from '../../services/realAPI'
import { getDocumentList, getDocumentContent } from '../../services/docs'
import type { ZLFNObject } from '../../types/zlfn'

// Mock the realAPI for integration testing
vi.mock('../../services/realAPI', () => ({
  realAPI: {
    listObjects: vi.fn(),
    getObject: vi.fn(),
    createObject: vi.fn(),
    updateObject: vi.fn(),
    deleteObject: vi.fn(),
    updateMarkdown: vi.fn()
  }
}))

const mockRealAPI = realAPI as any

const sampleZLFNObject: ZLFNObject = {
  id: 'integration-test-doc',
  markdownContent: '# Integration Test Document\n\nThis is a test document for integration testing.',
  zflnJson: {
    arguments: [{
      id: 'test-arg',
      core: {
        name: 'Test Argument',
        summary: 'A test argument for integration testing',
        layoutMode: 'standard',
        variables: [],
        mode: {}
      },
      zones: [],
      dependencies: [],
      modes: [],
      counterarguments: [],
      subarguments: [],
      validation: { isValid: true, errors: [] },
      pagination: { currentPage: 1, totalPages: 1 }
    }],
    metadata: {
      version: '1.0.0',
      created: '2025-01-01T00:00:00Z',
      modified: '2025-01-01T00:00:00Z',
      schema: 'zlfn-1.0'
    }
  },
  notes: {},
  versionHistory: [],
  metadata: {
    created: '2025-01-01T00:00:00Z',
    modified: '2025-01-01T00:00:00Z',
    fileReferences: [],
    title: 'Integration Test Document',
    author: 'Test Author',
    status: 'draft'
  }
}

describe('Database Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Document Lifecycle', () => {
    it('should handle complete document lifecycle', async () => {
      // 1. Initially no documents
      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: true,
        data: []
      })

      let docList = await getDocumentList()
      expect(docList.filter(doc => doc.source === 'database')).toHaveLength(0)

      // 2. Create a document
      mockRealAPI.createObject.mockResolvedValueOnce({
        success: true,
        data: sampleZLFNObject
      })

      const createResult = await mockRealAPI.createObject(sampleZLFNObject)
      expect(createResult.success).toBe(true)

      // 3. Document appears in list
      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: true,
        data: [sampleZLFNObject]
      })

      docList = await getDocumentList()
      const createdDoc = docList.find(doc => doc.id === 'integration-test-doc')
      expect(createdDoc).toEqual(
        expect.objectContaining({
          id: 'integration-test-doc',
          label: 'Integration Test Document',
          source: 'database',
          author: 'Test Author',
          status: 'draft'
        })
      )

      // 4. Content can be retrieved
      mockRealAPI.getObject.mockResolvedValueOnce({
        success: true,
        data: sampleZLFNObject
      })

      const content = await getDocumentContent('integration-test-doc')
      expect(content).toBe('# Integration Test Document\n\nThis is a test document for integration testing.')

      // 5. Update document
      const updatedObject = {
        ...sampleZLFNObject,
        markdownContent: '# Updated Integration Test Document\n\nThis document has been updated.',
        metadata: {
          ...sampleZLFNObject.metadata,
          modified: '2025-01-02T00:00:00Z'
        }
      }

      mockRealAPI.updateObject.mockResolvedValueOnce({
        success: true,
        data: updatedObject
      })

      const updateResult = await mockRealAPI.updateObject('integration-test-doc', {
        markdownContent: updatedObject.markdownContent
      })
      expect(updateResult.success).toBe(true)

      // 6. Updated content is retrieved
      mockRealAPI.getObject.mockResolvedValueOnce({
        success: true,
        data: updatedObject
      })

      const updatedContent = await getDocumentContent('integration-test-doc')
      expect(updatedContent).toBe('# Updated Integration Test Document\n\nThis document has been updated.')

      // 7. Delete document
      mockRealAPI.deleteObject.mockResolvedValueOnce({
        success: true
      })

      const deleteResult = await mockRealAPI.deleteObject('integration-test-doc')
      expect(deleteResult.success).toBe(true)

      // 8. Document no longer appears in list
      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: true,
        data: []
      })

      docList = await getDocumentList()
      const deletedDoc = docList.find(doc => doc.id === 'integration-test-doc')
      expect(deletedDoc).toBeUndefined()
    })

    it('should handle concurrent document operations', async () => {
      const doc1 = { ...sampleZLFNObject, id: 'doc-1', metadata: { ...sampleZLFNObject.metadata, title: 'Document 1' } }
      const doc2 = { ...sampleZLFNObject, id: 'doc-2', metadata: { ...sampleZLFNObject.metadata, title: 'Document 2' } }
      const doc3 = { ...sampleZLFNObject, id: 'doc-3', metadata: { ...sampleZLFNObject.metadata, title: 'Document 3' } }

      // Simulate concurrent creation
      mockRealAPI.createObject
        .mockResolvedValueOnce({ success: true, data: doc1 })
        .mockResolvedValueOnce({ success: true, data: doc2 })
        .mockResolvedValueOnce({ success: true, data: doc3 })

      const createPromises = [
        mockRealAPI.createObject(doc1),
        mockRealAPI.createObject(doc2),
        mockRealAPI.createObject(doc3)
      ]

      const results = await Promise.all(createPromises)
      expect(results.every(result => result.success)).toBe(true)

      // All documents should appear in list
      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: true,
        data: [doc1, doc2, doc3]
      })

      const docList = await getDocumentList()
      expect(docList.filter(doc => doc.source === 'database')).toHaveLength(3)
    })
  })

  describe('Error Scenarios', () => {
    it('should handle network failures gracefully', async () => {
      // Network failure during list operation
      mockRealAPI.listObjects.mockRejectedValueOnce(new Error('Network timeout'))

      const docList = await getDocumentList()
      // Should still return file-based documents
      expect(docList.some(doc => doc.source === 'file')).toBe(true)

      // Network failure during content retrieval
      mockRealAPI.getObject.mockRejectedValueOnce(new Error('Connection refused'))

      // Should fallback to file system if available
      const content = await getDocumentContent('test')
      expect(content).toBeTruthy() // Should get file content
    })

    it('should handle API rate limiting', async () => {
      // Simulate rate limiting
      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: false,
        error: 'Rate limit exceeded'
      })

      const docList = await getDocumentList()
      // Should gracefully handle and return file documents
      expect(Array.isArray(docList)).toBe(true)
    })

    it('should handle malformed API responses', async () => {
      // Malformed response
      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: true,
        data: null // Invalid data
      })

      const docList = await getDocumentList()
      expect(Array.isArray(docList)).toBe(true)

      // Malformed object data
      mockRealAPI.getObject.mockResolvedValueOnce({
        success: true,
        data: { id: 'test' } // Missing markdownContent
      })

      const content = await getDocumentContent('test')
      // Should fallback to file system
      expect(content).toBeTruthy()
    })

    it('should handle authentication failures', async () => {
      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: false,
        error: 'Unauthorized'
      })

      const docList = await getDocumentList()
      // Should still work with file-based documents
      expect(docList.length).toBeGreaterThan(0)
    })

    it('should handle server errors', async () => {
      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: false,
        error: 'Internal server error'
      })

      mockRealAPI.getObject.mockResolvedValueOnce({
        success: false,
        error: 'Database connection failed'
      })

      const docList = await getDocumentList()
      expect(Array.isArray(docList)).toBe(true)

      const content = await getDocumentContent('test')
      expect(content).toBeTruthy() // File fallback
    })
  })

  describe('Performance Scenarios', () => {
    it('should handle large document sets efficiently', async () => {
      // Create a large set of documents
      const largeDocumentSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `large-doc-${i}`,
        markdownContent: `# Document ${i}\n\nContent for document ${i}`,
        metadata: {
          title: `Document ${i}`,
          author: 'Performance Test',
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        }
      }))

      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: true,
        data: largeDocumentSet
      })

      const start = performance.now()
      const docList = await getDocumentList()
      const end = performance.now()

      expect(docList.length).toBeGreaterThanOrEqual(1000)
      expect(end - start).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle slow API responses', async () => {
      // Simulate slow API response
      mockRealAPI.listObjects.mockImplementationOnce(
        () => new Promise(resolve => 
          setTimeout(() => resolve({ success: true, data: [sampleZLFNObject] }), 2000)
        )
      )

      const start = performance.now()
      const docList = await getDocumentList()
      const end = performance.now()

      expect(docList.length).toBeGreaterThan(0)
      expect(end - start).toBeGreaterThan(1900) // Should respect the delay
    })

    it('should handle concurrent content requests', async () => {
      const documents = ['doc-1', 'doc-2', 'doc-3', 'doc-4', 'doc-5']
      
      // Setup responses for each document
      documents.forEach((docId, index) => {
        mockRealAPI.getObject.mockResolvedValueOnce({
          success: true,
          data: {
            id: docId,
            markdownContent: `# Document ${index + 1}\n\nContent for ${docId}`
          }
        })
      })

      // Request all documents concurrently
      const contentPromises = documents.map(docId => getDocumentContent(docId))
      const contents = await Promise.all(contentPromises)

      expect(contents).toHaveLength(5)
      expect(contents.every(content => content !== null)).toBe(true)
    })
  })

  describe('Data Consistency', () => {
    it('should maintain consistency between list and content operations', async () => {
      const testDoc = {
        id: 'consistency-test',
        markdownContent: '# Consistency Test\n\nTest content.',
        metadata: {
          title: 'Consistency Test Document',
          author: 'Test Author'
        }
      }

      // Document appears in list
      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: true,
        data: [testDoc]
      })

      const docList = await getDocumentList()
      const listedDoc = docList.find(doc => doc.id === 'consistency-test')
      expect(listedDoc).toBeDefined()

      // Same document can be retrieved by content
      mockRealAPI.getObject.mockResolvedValueOnce({
        success: true,
        data: testDoc
      })

      const content = await getDocumentContent('consistency-test')
      expect(content).toBe('# Consistency Test\n\nTest content.')
    })

    it('should handle stale data scenarios', async () => {
      const originalDoc = {
        id: 'stale-test',
        markdownContent: '# Original Content',
        metadata: { title: 'Original Title', modified: '2025-01-01T00:00:00Z' }
      }

      const updatedDoc = {
        id: 'stale-test',
        markdownContent: '# Updated Content',
        metadata: { title: 'Updated Title', modified: '2025-01-02T00:00:00Z' }
      }

      // List shows updated version
      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: true,
        data: [updatedDoc]
      })

      const docList = await getDocumentList()
      const listedDoc = docList.find(doc => doc.id === 'stale-test')
      expect(listedDoc?.label).toBe('Updated Title')

      // Content retrieval also returns updated version
      mockRealAPI.getObject.mockResolvedValueOnce({
        success: true,
        data: updatedDoc
      })

      const content = await getDocumentContent('stale-test')
      expect(content).toBe('# Updated Content')
    })
  })

  describe('Hybrid Fallback Scenarios', () => {
    it('should seamlessly fallback from database to files', async () => {
      // Database has some documents but not all
      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: true,
        data: [sampleZLFNObject]
      })

      const docList = await getDocumentList()
      
      // Should have both database and file documents
      const dbDocs = docList.filter(doc => doc.source === 'database')
      const fileDocs = docList.filter(doc => doc.source === 'file')
      
      expect(dbDocs.length).toBeGreaterThan(0)
      expect(fileDocs.length).toBeGreaterThan(0)

      // Content retrieval should work for both types
      mockRealAPI.getObject
        .mockResolvedValueOnce({ success: true, data: sampleZLFNObject })
        .mockResolvedValueOnce({ success: false, data: null })

      const dbContent = await getDocumentContent('integration-test-doc')
      expect(dbContent).toBeTruthy()

      const fileContent = await getDocumentContent('test')
      expect(fileContent).toBeTruthy()
    })

    it('should handle partial database failures', async () => {
      // List operation succeeds but content operations fail
      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: true,
        data: [sampleZLFNObject]
      })

      const docList = await getDocumentList()
      expect(docList.some(doc => doc.source === 'database')).toBe(true)

      // Content retrieval fails for database document
      mockRealAPI.getObject.mockRejectedValueOnce(new Error('Database error'))

      const content = await getDocumentContent('integration-test-doc')
      // Should return null since no file fallback for this ID
      expect(content).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty document content', async () => {
      const emptyDoc = {
        id: 'empty-doc',
        markdownContent: '',
        metadata: { title: 'Empty Document' }
      }

      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: true,
        data: [emptyDoc]
      })

      const docList = await getDocumentList()
      expect(docList.find(doc => doc.id === 'empty-doc')).toBeDefined()

      mockRealAPI.getObject.mockResolvedValueOnce({
        success: true,
        data: emptyDoc
      })

      const content = await getDocumentContent('empty-doc')
      expect(content).toBe('') // Empty string should be returned, not null
    })

    it('should handle very long document IDs', async () => {
      const longId = 'a'.repeat(100)
      const longIdDoc = {
        id: longId,
        markdownContent: '# Long ID Document',
        metadata: { title: 'Document with Very Long ID' }
      }

      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: true,
        data: [longIdDoc]
      })

      const docList = await getDocumentList()
      expect(docList.find(doc => doc.id === longId)).toBeDefined()
    })

    it('should handle special characters in document IDs', async () => {
      const specialId = 'doc-with-special_chars-123'
      const specialDoc = {
        id: specialId,
        markdownContent: '# Special Characters Document',
        metadata: { title: 'Document with Special Characters' }
      }

      mockRealAPI.listObjects.mockResolvedValueOnce({
        success: true,
        data: [specialDoc]
      })

      const docList = await getDocumentList()
      expect(docList.find(doc => doc.id === specialId)).toBeDefined()

      mockRealAPI.getObject.mockResolvedValueOnce({
        success: true,
        data: specialDoc
      })

      const content = await getDocumentContent(specialId)
      expect(content).toBe('# Special Characters Document')
    })
  })
})
