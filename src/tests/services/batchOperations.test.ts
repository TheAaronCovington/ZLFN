import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { batchOperations } from '../../services/batchOperations';
import { api } from '../../services/zlfnAPI';

// Mock the API
vi.mock('../../services/zlfnAPI', () => ({
  api: {
    saveNote: vi.fn(),
    revertToVersion: vi.fn(),
    getObject: vi.fn(),
    getAllObjects: vi.fn(),
  }
}));

describe('BatchOperationsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchOperations.clearCompleted();
  });

  afterEach(() => {
    batchOperations.clearCompleted();
  });

  describe('batchEditNotes', () => {
    it('should execute batch note edits successfully', async () => {
      const mockEdits = [
        {
          objectId: 'obj1',
          nodeId: 'node1',
          oldContent: 'old content 1',
          newContent: 'new content 1'
        },
        {
          objectId: 'obj2',
          nodeId: 'node2',
          oldContent: 'old content 2',
          newContent: 'new content 2'
        }
      ];

      // Mock successful API responses
      (api.saveNote as any).mockResolvedValue({ success: true });

      const operationId = await batchOperations.batchEditNotes(mockEdits);

      expect(operationId).toBeTruthy();
      expect(api.saveNote).toHaveBeenCalledTimes(2);
      expect(api.saveNote).toHaveBeenCalledWith('obj1', 'node1', 'new content 1');
      expect(api.saveNote).toHaveBeenCalledWith('obj2', 'node2', 'new content 2');

      // Check operation status
      const operation = batchOperations.getOperation(operationId);
      expect(operation?.status).toBe('completed');
      expect(operation?.progress).toBe(100);
    });

    it('should handle partial failures in batch note edits', async () => {
      const mockEdits = [
        {
          objectId: 'obj1',
          nodeId: 'node1',
          oldContent: 'old content 1',
          newContent: 'new content 1'
        },
        {
          objectId: 'obj2',
          nodeId: 'node2',
          oldContent: 'old content 2',
          newContent: 'new content 2'
        }
      ];

      // Mock mixed API responses
      (api.saveNote as any)
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('API Error'));

      const operationId = await batchOperations.batchEditNotes(mockEdits);

      const operation = batchOperations.getOperation(operationId);
      expect(operation?.status).toBe('completed');
      expect(operation?.result).toHaveLength(2);
      expect(operation?.result[0].success).toBe(true);
      expect(operation?.result[1].success).toBe(false);
      expect(operation?.result[1].error).toBe('API Error');
    });

    it('should update progress during batch operations', async () => {
      const mockEdits = [
        {
          objectId: 'obj1',
          nodeId: 'node1',
          oldContent: 'old',
          newContent: 'new'
        }
      ];

      (api.saveNote as any).mockResolvedValue({ success: true });

      let progressUpdates: number[] = [];
      const unsubscribe = batchOperations.subscribe((operations) => {
        const op = operations.find(o => o.type === 'note-edit');
        if (op) {
          progressUpdates.push(op.progress);
        }
      });

      await batchOperations.batchEditNotes(mockEdits);
      unsubscribe();

      expect(progressUpdates).toContain(0); // Initial
      expect(progressUpdates).toContain(100); // Final
    });
  });

  describe('batchVersionOperations', () => {
    it('should execute batch version operations successfully', async () => {
      const mockOperations = [
        {
          objectId: 'obj1',
          versionTimestamp: '2024-01-01T00:00:00Z',
          operation: 'revert' as const
        },
        {
          objectId: 'obj2',
          versionTimestamp: '2024-01-02T00:00:00Z',
          operation: 'revert' as const
        }
      ];

      (api.revertToVersion as any).mockResolvedValue({ success: true });

      const operationId = await batchOperations.batchVersionOperations(mockOperations);

      expect(operationId).toBeTruthy();
      expect(api.revertToVersion).toHaveBeenCalledTimes(2);
      expect(api.revertToVersion).toHaveBeenCalledWith('obj1', '2024-01-01T00:00:00Z');
      expect(api.revertToVersion).toHaveBeenCalledWith('obj2', '2024-01-02T00:00:00Z');

      const operation = batchOperations.getOperation(operationId);
      expect(operation?.status).toBe('completed');
    });

    it('should handle different operation types', async () => {
      const mockOperations = [
        {
          objectId: 'obj1',
          versionTimestamp: '2024-01-01T00:00:00Z',
          operation: 'delete' as const
        },
        {
          objectId: 'obj2',
          versionTimestamp: '2024-01-02T00:00:00Z',
          operation: 'compare' as const
        }
      ];

      const operationId = await batchOperations.batchVersionOperations(mockOperations);

      const operation = batchOperations.getOperation(operationId);
      expect(operation?.status).toBe('completed');
      expect(operation?.result).toHaveLength(2);
      
      // These operations are not yet implemented, so they return placeholder messages
      expect(operation?.result[0].result.message).toContain('Delete operation not yet implemented');
      expect(operation?.result[1].result.message).toContain('Compare operation not yet implemented');
    });
  });

  describe('batchExport', () => {
    it('should execute batch export successfully', async () => {
      const mockOptions = {
        objectIds: ['obj1', 'obj2'],
        format: 'json' as const,
        includeNotes: true,
        includeVersionHistory: false
      };

      const mockObjects = [
        {
          id: 'obj1',
          zflnJson: { arguments: [] },
          notes: { 'node1': 'note1' },
          metadata: { created: '2024-01-01', modified: '2024-01-01', fileReferences: [] }
        },
        {
          id: 'obj2',
          zflnJson: { arguments: [] },
          notes: { 'node2': 'note2' },
          metadata: { created: '2024-01-02', modified: '2024-01-02', fileReferences: [] }
        }
      ];

      (api.getObject as any)
        .mockResolvedValueOnce({ success: true, data: mockObjects[0] })
        .mockResolvedValueOnce({ success: true, data: mockObjects[1] });

      // Mock DOM methods for download
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      document.createElement = vi.fn().mockReturnValue(mockAnchor);
      document.body.appendChild = vi.fn();
      document.body.removeChild = vi.fn();
      global.URL.createObjectURL = vi.fn().mockReturnValue('mock-url');
      global.URL.revokeObjectURL = vi.fn();

      const operationId = await batchOperations.batchExport(mockOptions);

      expect(operationId).toBeTruthy();
      expect(api.getObject).toHaveBeenCalledTimes(2);
      expect(api.getObject).toHaveBeenCalledWith('obj1');
      expect(api.getObject).toHaveBeenCalledWith('obj2');

      const operation = batchOperations.getOperation(operationId);
      expect(operation?.status).toBe('completed');
      expect(operation?.result.exportCount).toBe(2);

      // Verify download was triggered
      expect(mockAnchor.click).toHaveBeenCalled();
    });

    it('should handle export failures gracefully', async () => {
      const mockOptions = {
        objectIds: ['obj1', 'invalid-obj'],
        format: 'json' as const,
        includeNotes: true,
        includeVersionHistory: false
      };

      (api.getObject as any)
        .mockResolvedValueOnce({ success: true, data: { id: 'obj1', zflnJson: { arguments: [] } } })
        .mockRejectedValueOnce(new Error('Object not found'));

      // Mock DOM methods
      document.createElement = vi.fn().mockReturnValue({ href: '', download: '', click: vi.fn() });
      document.body.appendChild = vi.fn();
      document.body.removeChild = vi.fn();

      const operationId = await batchOperations.batchExport(mockOptions);

      const operation = batchOperations.getOperation(operationId);
      expect(operation?.status).toBe('completed');
      expect(operation?.result.exportCount).toBe(2); // Both attempts are recorded
    });
  });

  describe('operation management', () => {
    it('should track multiple operations', async () => {
      const edits1 = [{ objectId: 'obj1', nodeId: 'node1', oldContent: 'old', newContent: 'new' }];
      const edits2 = [{ objectId: 'obj2', nodeId: 'node2', oldContent: 'old', newContent: 'new' }];

      (api.saveNote as any).mockResolvedValue({ success: true });

      const op1 = await batchOperations.batchEditNotes(edits1);
      const op2 = await batchOperations.batchEditNotes(edits2);

      const allOps = batchOperations.getAllOperations();
      expect(allOps).toHaveLength(2);
      expect(allOps.map(op => op.id)).toContain(op1);
      expect(allOps.map(op => op.id)).toContain(op2);
    });

    it('should clear completed operations', async () => {
      const edits = [{ objectId: 'obj1', nodeId: 'node1', oldContent: 'old', newContent: 'new' }];
      (api.saveNote as any).mockResolvedValue({ success: true });

      await batchOperations.batchEditNotes(edits);
      
      expect(batchOperations.getAllOperations()).toHaveLength(1);
      
      batchOperations.clearCompleted();
      
      expect(batchOperations.getAllOperations()).toHaveLength(0);
    });

    it('should cancel pending operations', () => {
      // Create a mock operation
      const mockOperation = {
        id: 'test-op',
        type: 'note-edit' as const,
        status: 'pending' as const,
        progress: 0
      };

      // Manually add to operations map for testing
      (batchOperations as any).operations.set('test-op', mockOperation);

      const cancelled = batchOperations.cancelOperation('test-op');
      expect(cancelled).toBe(true);

      const operation = batchOperations.getOperation('test-op');
      expect(operation?.status).toBe('failed');
      expect(operation?.error).toBe('Cancelled by user');
    });

    it('should not cancel running operations', () => {
      const mockOperation = {
        id: 'test-op',
        type: 'note-edit' as const,
        status: 'running' as const,
        progress: 50
      };

      (batchOperations as any).operations.set('test-op', mockOperation);

      const cancelled = batchOperations.cancelOperation('test-op');
      expect(cancelled).toBe(false);

      const operation = batchOperations.getOperation('test-op');
      expect(operation?.status).toBe('running');
    });
  });

  describe('subscription system', () => {
    it('should notify subscribers of operation updates', async () => {
      const edits = [{ objectId: 'obj1', nodeId: 'node1', oldContent: 'old', newContent: 'new' }];
      (api.saveNote as any).mockResolvedValue({ success: true });

      let notificationCount = 0;
      const unsubscribe = batchOperations.subscribe(() => {
        notificationCount++;
      });

      await batchOperations.batchEditNotes(edits);
      unsubscribe();

      expect(notificationCount).toBeGreaterThan(0);
    });

    it('should allow multiple subscribers', async () => {
      const edits = [{ objectId: 'obj1', nodeId: 'node1', oldContent: 'old', newContent: 'new' }];
      (api.saveNote as any).mockResolvedValue({ success: true });

      let count1 = 0, count2 = 0;
      const unsub1 = batchOperations.subscribe(() => count1++);
      const unsub2 = batchOperations.subscribe(() => count2++);

      await batchOperations.batchEditNotes(edits);

      unsub1();
      unsub2();

      expect(count1).toBeGreaterThan(0);
      expect(count2).toBeGreaterThan(0);
      expect(count1).toBe(count2); // Both should receive same number of notifications
    });

    it('should properly unsubscribe', async () => {
      const edits = [{ objectId: 'obj1', nodeId: 'node1', oldContent: 'old', newContent: 'new' }];
      (api.saveNote as any).mockResolvedValue({ success: true });

      let count = 0;
      const unsubscribe = batchOperations.subscribe(() => count++);
      
      await batchOperations.batchEditNotes(edits);
      const countAfterFirst = count;
      
      unsubscribe();
      
      await batchOperations.batchEditNotes(edits);
      
      expect(count).toBe(countAfterFirst); // Should not increase after unsubscribe
    });
  });
});
