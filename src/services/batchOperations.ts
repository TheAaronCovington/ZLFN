import { api } from './zlfnAPI';
import type { ZLFNObject } from '../types/zlfn';

export interface BatchOperation {
  id: string;
  type: 'note-edit' | 'version-revert' | 'export' | 'delete';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  error?: string;
  result?: any;
}

export interface BatchNoteEdit {
  objectId: string;
  nodeId: string;
  oldContent: string;
  newContent: string;
}

export interface BatchVersionOperation {
  objectId: string;
  versionTimestamp: string;
  operation: 'revert' | 'delete' | 'compare';
}

export interface BatchExportOptions {
  objectIds: string[];
  format: 'json' | 'pdf' | 'markdown';
  includeNotes: boolean;
  includeVersionHistory: boolean;
}

class BatchOperationsService {
  private operations = new Map<string, BatchOperation>();
  private listeners = new Set<(operations: BatchOperation[]) => void>();

  // Subscribe to batch operation updates
  subscribe(listener: (operations: BatchOperation[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const operations = Array.from(this.operations.values());
    this.listeners.forEach(listener => listener(operations));
  }

  private updateOperation(id: string, updates: Partial<BatchOperation>) {
    const operation = this.operations.get(id);
    if (operation) {
      Object.assign(operation, updates);
      this.notifyListeners();
    }
  }

  // Batch note editing
  async batchEditNotes(edits: BatchNoteEdit[]): Promise<string> {
    const operationId = `batch-notes-${Date.now()}`;
    const operation: BatchOperation = {
      id: operationId,
      type: 'note-edit',
      status: 'pending',
      progress: 0
    };

    this.operations.set(operationId, operation);
    this.notifyListeners();

    try {
      this.updateOperation(operationId, { status: 'running' });

      const results = [];
      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        
        try {
          // Update the note
          await api.saveNote(edit.objectId, edit.nodeId, edit.newContent);
          results.push({ success: true, objectId: edit.objectId, nodeId: edit.nodeId });
          
          // Update progress
          const progress = ((i + 1) / edits.length) * 100;
          this.updateOperation(operationId, { progress });
          
          // Small delay to prevent overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          results.push({ 
            success: false, 
            objectId: edit.objectId, 
            nodeId: edit.nodeId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      this.updateOperation(operationId, { 
        status: 'completed', 
        progress: 100,
        result: results
      });

      return operationId;
    } catch (error) {
      this.updateOperation(operationId, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  // Batch version operations
  async batchVersionOperations(operations: BatchVersionOperation[]): Promise<string> {
    const operationId = `batch-versions-${Date.now()}`;
    const batchOp: BatchOperation = {
      id: operationId,
      type: 'version-revert',
      status: 'pending',
      progress: 0
    };

    this.operations.set(operationId, batchOp);
    this.notifyListeners();

    try {
      this.updateOperation(operationId, { status: 'running' });

      const results = [];
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        
        try {
          let result;
          switch (op.operation) {
            case 'revert':
              result = await api.revertToVersion(op.objectId, op.versionTimestamp);
              break;
            case 'delete':
              // Note: This would need to be implemented in the API
              result = { success: true, message: 'Delete operation not yet implemented' };
              break;
            case 'compare':
              // Note: This would return comparison data
              result = { success: true, message: 'Compare operation not yet implemented' };
              break;
          }
          
          results.push({ success: true, objectId: op.objectId, result });
          
          // Update progress
          const progress = ((i + 1) / operations.length) * 100;
          this.updateOperation(operationId, { progress });
          
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          results.push({ 
            success: false, 
            objectId: op.objectId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      this.updateOperation(operationId, { 
        status: 'completed', 
        progress: 100,
        result: results
      });

      return operationId;
    } catch (error) {
      this.updateOperation(operationId, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  // Batch export
  async batchExport(options: BatchExportOptions): Promise<string> {
    const operationId = `batch-export-${Date.now()}`;
    const operation: BatchOperation = {
      id: operationId,
      type: 'export',
      status: 'pending',
      progress: 0
    };

    this.operations.set(operationId, operation);
    this.notifyListeners();

    try {
      this.updateOperation(operationId, { status: 'running' });

      const exports = [];
      for (let i = 0; i < options.objectIds.length; i++) {
        const objectId = options.objectIds[i];
        
        try {
          // Get the object
          const response = await api.getObject(objectId);
          if (response.success && response.data) {
            const object = response.data;
            
            // Generate export data based on format
            let exportData;
            switch (options.format) {
              case 'json':
                exportData = {
                  id: object.id,
                  zflnJson: object.zflnJson,
                  notes: options.includeNotes ? object.notes : undefined,
                  versionHistory: options.includeVersionHistory ? object.versionHistory : undefined,
                  metadata: object.metadata
                };
                break;
              case 'markdown':
                exportData = this.generateMarkdown(object, options);
                break;
              default:
                exportData = object;
            }
            
            exports.push({ objectId, data: exportData });
          }
          
          // Update progress
          const progress = ((i + 1) / options.objectIds.length) * 100;
          this.updateOperation(operationId, { progress });
          
          await new Promise(resolve => setTimeout(resolve, 150));
        } catch (error) {
          exports.push({ 
            objectId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      // Create combined export file
      const combinedExport = {
        exportedAt: new Date().toISOString(),
        format: options.format,
        options,
        objects: exports
      };

      // Download the combined export
      const blob = new Blob([JSON.stringify(combinedExport, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.updateOperation(operationId, { 
        status: 'completed', 
        progress: 100,
        result: { exportCount: exports.length, filename: a.download }
      });

      return operationId;
    } catch (error) {
      this.updateOperation(operationId, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  private generateMarkdown(object: ZLFNObject, options: BatchExportOptions): string {
    let markdown = `# ${object.id}\n\n`;
    
    if (object.metadata) {
      markdown += `## Metadata\n\n`;
      markdown += `- **Created:** ${new Date(object.metadata.created).toLocaleString()}\n`;
      markdown += `- **Modified:** ${new Date(object.metadata.modified).toLocaleString()}\n`;
      if (object.metadata.author) {
        markdown += `- **Author:** ${object.metadata.author}\n`;
      }
      markdown += '\n';
    }

    if (options.includeNotes && object.notes) {
      markdown += `## Notes\n\n`;
      Object.entries(object.notes).forEach(([nodeId, content]) => {
        markdown += `### ${nodeId}\n${content}\n\n`;
      });
    }

    return markdown;
  }

  // Get operation status
  getOperation(id: string): BatchOperation | undefined {
    return this.operations.get(id);
  }

  // Get all operations
  getAllOperations(): BatchOperation[] {
    return Array.from(this.operations.values());
  }

  // Clear completed operations
  clearCompleted(): void {
    for (const [id, operation] of this.operations) {
      if (operation.status === 'completed' || operation.status === 'failed') {
        this.operations.delete(id);
      }
    }
    this.notifyListeners();
  }

  // Cancel operation (if possible)
  cancelOperation(id: string): boolean {
    const operation = this.operations.get(id);
    if (operation && operation.status === 'pending') {
      this.updateOperation(id, { status: 'failed', error: 'Cancelled by user' });
      return true;
    }
    return false;
  }
}

export const batchOperations = new BatchOperationsService();
export default batchOperations;
