import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { zlfnObjectManager } from '../../services/zlfnObjectManager'
import { createEmptyZLFNObject } from '../../types/zlfn'

// Mock localStorage for browser environment tests
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  key: vi.fn(),
  length: 0,
  clear: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('ZLFNObjectManager Backup System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.length = 0
    
    // Clear the object manager
    const manager = zlfnObjectManager as any
    manager.objects.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('backup()', () => {
    it('should create a backup with correct structure', async () => {
      // Create test objects
      const obj1 = await zlfnObjectManager.createObject('Test markdown 1')
      const obj2 = await zlfnObjectManager.createObject('Test markdown 2')
      
      // Mock localStorage.setItem
      let capturedBackupData: string = ''
      localStorageMock.setItem.mockImplementation((key: string, value: string) => {
        capturedBackupData = value
      })
      
      const result = await zlfnObjectManager.backup()
      
      expect(result.success).toBe(true)
      expect(result.backupPath).toMatch(/^backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)
      expect(localStorageMock.setItem).toHaveBeenCalledOnce()
      
      // Verify backup structure
      const backupData = JSON.parse((zlfnObjectManager as any).decompressString(capturedBackupData))
      expect(backupData).toHaveProperty('timestamp')
      expect(backupData).toHaveProperty('version', '1.0.0')
      expect(backupData).toHaveProperty('objectCount', 2)
      expect(backupData.objects).toHaveLength(2)
      expect(backupData.objects[0]).toHaveProperty('id')
      expect(backupData.objects[0]).toHaveProperty('markdownContent')
    })

    it('should handle empty object store', async () => {
      const result = await zlfnObjectManager.backup()
      
      expect(result.success).toBe(true)
      expect(localStorageMock.setItem).toHaveBeenCalledOnce()
    })

    it('should handle backup errors gracefully', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage full')
      })
      
      const result = await zlfnObjectManager.backup()
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Storage full')
    })
  })

  describe('restoreFromBackup()', () => {
    it('should restore objects from backup', async () => {
      // Create backup data
      const backupData = {
        timestamp: '2025-01-01T00:00:00.000Z',
        version: '1.0.0',
        objectCount: 1,
        objects: [
          {
            id: 'test-object-1',
            markdown: 'Test content',
            zflnJson: { arguments: [], dependencies: [], metadata: {} },
            notes: { 'node1': 'Test note' },
            versionHistory: [
              {
                timestamp: '2025-01-01T00:00:00.000Z',
                markdown: 'Test content',
                zflnJson: { arguments: [], dependencies: [], metadata: {} },
                notes: { 'node1': 'Test note' },
                changeType: 'created',
                changeDescription: 'Initial version'
              }
            ],
            metadata: {
              created: '2025-01-01T00:00:00.000Z',
              modified: '2025-01-01T00:00:00.000Z'
            }
          }
        ]
      }
      
      const compressedData = (zlfnObjectManager as any).compressString(JSON.stringify(backupData))
      localStorageMock.getItem.mockReturnValue(compressedData)
      
      const result = await zlfnObjectManager.restoreFromBackup('backup_test')
      
      expect(result.success).toBe(true)
      expect(result.restoredCount).toBe(1)
      
      // Verify object was restored
      const restoredObject = await zlfnObjectManager.getObject('test-object-1')
      expect(restoredObject).toBeTruthy()
      expect(restoredObject?.markdown).toBe('Test content')
      expect(restoredObject?.notes.get('node1')).toBe('Test note')
    })

    it('should handle missing backup', async () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      const result = await zlfnObjectManager.restoreFromBackup('nonexistent-backup')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Backup not found in localStorage')
    })

    it('should handle invalid backup format', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(['invalid', 'data']))
      
      const result = await zlfnObjectManager.restoreFromBackup('invalid-backup')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid')
    })
  })

  describe('listBackups()', () => {
    it('should list available backups', async () => {
      // Mock localStorage keys
      localStorageMock.length = 3
      localStorageMock.key.mockImplementation((index: number) => {
        const keys = ['backup_2025-01-01T10-00-00', 'backup_2025-01-02T10-00-00', 'other-key']
        return keys[index] || null
      })
      
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key.startsWith('backup_')) {
          return 'compressed-data'
        }
        return null
      })
      
      const result = await zlfnObjectManager.listBackups()
      
      expect(result.success).toBe(true)
      expect(result.backups).toHaveLength(2)
      expect(result.backups![0]).toHaveProperty('path')
      expect(result.backups![0]).toHaveProperty('timestamp')
      expect(result.backups![0]).toHaveProperty('size')
      
      // Should be sorted by timestamp (newest first)
      expect(new Date(result.backups![0].timestamp).getTime())
        .toBeGreaterThan(new Date(result.backups![1].timestamp).getTime())
    })

    it('should return empty list when no backups exist', async () => {
      localStorageMock.length = 0
      
      const result = await zlfnObjectManager.listBackups()
      
      expect(result.success).toBe(true)
      expect(result.backups).toHaveLength(0)
    })
  })

  describe('deleteBackup()', () => {
    it('should delete backup successfully', async () => {
      const result = await zlfnObjectManager.deleteBackup('backup_test')
      
      expect(result.success).toBe(true)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('backup_test')
    })

    it('should handle delete errors gracefully', async () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Delete failed')
      })
      
      const result = await zlfnObjectManager.deleteBackup('backup_test')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Delete failed')
    })
  })

  describe('compression utilities', () => {
    it('should compress and decompress strings correctly', () => {
      const manager = zlfnObjectManager as any
      const originalString = 'This is a test string with repeated patterns. This is a test string with repeated patterns.'
      
      const compressed = manager.compressString(originalString)
      const decompressed = manager.decompressString(compressed)
      
      expect(decompressed).toBe(originalString)
      expect(compressed.length).toBeLessThan(originalString.length)
    })

    it('should handle empty strings', () => {
      const manager = zlfnObjectManager as any
      const originalString = ''
      
      const compressed = manager.compressString(originalString)
      const decompressed = manager.decompressString(compressed)
      
      expect(decompressed).toBe(originalString)
    })

    it('should handle single character strings', () => {
      const manager = zlfnObjectManager as any
      const originalString = 'a'
      
      const compressed = manager.compressString(originalString)
      const decompressed = manager.decompressString(compressed)
      
      expect(decompressed).toBe(originalString)
    })
  })
})
