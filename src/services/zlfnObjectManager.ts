/**
 * ZLFN Object Manager
 * Core service for managing ZLFN objects, version control, and persistence
 */

import type { 
  ZLFNObject, 
  ZLFNStructure, 
  ZLFNVersion, 
  ImportResult, 
  MergeResult, 
  MergeOptions, 
  Conflict, 
  ConflictResolution,
  UploadValidation
} from '../types/zlfn'
import { createEmptyZLFNObject } from '../types/zlfn'

export class ZLFNObjectManager {
  private objects: Map<string, ZLFNObject> = new Map()
  private locks: Map<string, { userId: string; expires: number }> = new Map()

  // Object CRUD Operations
  async createObject(markdown?: string, initialJson?: ZLFNStructure): Promise<ZLFNObject> {
    const id = this.generateId()
    const object = createEmptyZLFNObject(id)
    
    if (markdown) {
      object.markdown = this.sanitizeMarkdown(markdown)
    }
    
    if (initialJson) {
      object.zflnJson = initialJson
    }

    // Create initial version
    const initialVersion: ZLFNVersion = {
      timestamp: new Date().toISOString(),
      markdown: object.markdown,
      zflnJson: object.zflnJson,
      notes: object.notes,
      changeType: 'created',
      changeDescription: 'Initial version'
    }
    
    object.versionHistory.push(initialVersion)
    object.metadata.modified = new Date().toISOString()
    
    this.objects.set(id, object)
    return object
  }

  // Ensure an object exists with a specific ID (for demos)
  async ensureObject(id: string): Promise<ZLFNObject> {
    const existing = this.objects.get(id)
    if (existing) return existing

    const object = createEmptyZLFNObject(id)
    // Seed an initial version for this fixed id
    const initialVersion: ZLFNVersion = {
      timestamp: new Date().toISOString(),
      markdown: object.markdown,
      zflnJson: object.zflnJson,
      notes: object.notes,
      changeType: 'created',
      changeDescription: 'Initial version (ensure)'
    }
    object.versionHistory.push(initialVersion)
    this.objects.set(id, object)
    return object
  }

  async getObject(id: string): Promise<ZLFNObject | null> {
    return this.objects.get(id) || null
  }

  async updateObject(id: string, updates: Partial<ZLFNObject>): Promise<ZLFNObject | null> {
    const object = this.objects.get(id)
    if (!object) return null

    // Check for edit locks
    if (this.isLocked(id)) {
      throw new Error('Object is currently locked by another user')
    }

    const previousState = { ...object }
    
    // Create new version before updating
    const newVersion: ZLFNVersion = {
      timestamp: new Date().toISOString(),
      markdown: updates.markdown || object.markdown,
      zflnJson: updates.zflnJson || object.zflnJson,
      notes: updates.notes || object.notes,
      changeType: 'modified',
      changeDescription: this.generateChangeDescription(previousState, updates)
    }

    // Update object
    Object.assign(object, updates, {
      metadata: {
        ...object.metadata,
        modified: new Date().toISOString()
      }
    })

    // Limit version history to 20 versions
    if (object.versionHistory.length >= 20) {
      object.versionHistory.shift()
    }
    
    object.versionHistory.push(newVersion)
    this.objects.set(id, object)
    
    return object
  }

  async deleteObject(id: string): Promise<boolean> {
    if (this.isLocked(id)) {
      throw new Error('Cannot delete locked object')
    }
    
    return this.objects.delete(id)
  }

  // Markdown Operations
  async updateMarkdown(id: string, markdown: string, _author?: string): Promise<ZLFNObject | null> {
    const sanitized = this.sanitizeMarkdown(markdown)
    return this.updateObject(id, { 
      markdown: sanitized
    })
  }

  private sanitizeMarkdown(markdown: string): string {
    // Basic sanitization - in production, use a proper library like DOMPurify
    return markdown
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .trim()
  }

  // JSON Operations with Merge Support
  async updateJSON(
    id: string, 
    newJson: ZLFNStructure, 
    options: MergeOptions = {
      strategy: 'merge',
      preserveNotes: true,
      validateStructure: true,
      createBackup: true
    }
  ): Promise<MergeResult> {
    const object = this.objects.get(id)
    if (!object) {
      throw new Error('Object not found')
    }

    // Validate structure if requested
    if (options.validateStructure) {
      const validation = this.validateZLFNStructure(newJson)
      if (!validation.isValid) {
        return {
          success: false,
          mergedArguments: 0,
          resolvedConflicts: [],
          newNotesMappings: {},
          warnings: validation.warnings,
          errors: validation.errors
        }
      }
    }

    // Create backup if requested
    let backupVersionId: string | undefined
    if (options.createBackup) {
      const backupVersion: ZLFNVersion = {
        timestamp: new Date().toISOString(),
        markdown: object.markdown,
        zflnJson: object.zflnJson,
        notes: object.notes,
        changeType: 'modified',
        changeDescription: 'Backup before JSON update'
      }
      object.versionHistory.push(backupVersion)
      backupVersionId = backupVersion.timestamp
    }

    // Detect conflicts
    const conflicts = this.detectConflicts(object.zflnJson, newJson)
    
    // Merge based on strategy
    const mergeResult = await this.mergeZLFNStructures(
      object.zflnJson, 
      newJson, 
      conflicts, 
      options
    )

    if (mergeResult.success) {
      // Update notes mappings if preserving notes
      if (options.preserveNotes) {
        object.notes = this.remapNotes(object.notes, mergeResult.newNotesMappings)
      }

      // Update object
      await this.updateObject(id, {
        zflnJson: mergeResult.mergedStructure,
        notes: object.notes
      })
    }

    return {
      ...mergeResult,
      backupVersionId
    }
  }

  // Import Operations
  async importFromFile(file: File, existingObjectId?: string): Promise<ImportResult> {
    const validation = await this.validateUpload(file)
    
    if (!validation.isValid) {
      return {
        success: false,
        conflicts: [],
        warnings: validation.warnings,
        errors: validation.errors
      }
    }

    try {
      const content = await this.readFileContent(file)
      
      if (validation.fileType === 'markdown') {
        return this.importMarkdown(content, existingObjectId)
      } else if (validation.fileType === 'json') {
        return this.importJSON(content, existingObjectId)
      }
      
      return {
        success: false,
        conflicts: [],
        errors: ['Unsupported file type']
      }
    } catch (error) {
      return {
        success: false,
        conflicts: [],
        errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  private async importMarkdown(markdown: string, existingObjectId?: string): Promise<ImportResult> {
    if (existingObjectId) {
      const object = await this.updateMarkdown(existingObjectId, markdown)
      return {
        success: !!object,
        objectId: existingObjectId,
        conflicts: [],
        warnings: object ? [] : ['Failed to update existing object']
      }
    } else {
      const object = await this.createObject(markdown)
      return {
        success: true,
        objectId: object.id,
        conflicts: []
      }
    }
  }

  private async importJSON(jsonContent: string, existingObjectId?: string): Promise<ImportResult> {
    try {
      const parsedJson: ZLFNStructure = JSON.parse(jsonContent)
      
      if (existingObjectId) {
        const mergeResult = await this.updateJSON(existingObjectId, parsedJson)
        return {
          success: mergeResult.success,
          objectId: existingObjectId,
          conflicts: mergeResult.resolvedConflicts.map(r => ({
            type: 'duplicate_id',
            description: r.description,
            existingValue: null,
            incomingValue: null
          })),
          mergedArguments: mergeResult.mergedArguments,
          warnings: mergeResult.warnings,
          errors: mergeResult.errors
        }
      } else {
        const object = await this.createObject(undefined, parsedJson)
        return {
          success: true,
          objectId: object.id,
          conflicts: [],
          mergedArguments: parsedJson.arguments.length
        }
      }
    } catch (error) {
      return {
        success: false,
        conflicts: [],
        errors: [`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  // Notes Operations
  async saveNote(objectId: string, nodeId: string, noteContent: string, _author?: string): Promise<boolean> {
    const object = this.objects.get(objectId)
    if (!object) return false
    object.notes[nodeId] = noteContent

    // Create version for note change
    const noteVersion: ZLFNVersion = {
      timestamp: new Date().toISOString(),
      markdown: object.markdown,
      zflnJson: object.zflnJson,
      notes: object.notes,
      author: _author,
      changeType: 'modified',
      changeDescription: `Updated note for node ${nodeId}`
    }

    // Limit version history
    if (object.versionHistory.length >= 20) {
      object.versionHistory.shift()
    }

    object.versionHistory.push(noteVersion)
    object.metadata.modified = new Date().toISOString()
    
    this.objects.set(objectId, object)
    return true
  }

  async deleteNote(objectId: string, nodeId: string): Promise<boolean> {
    const object = this.objects.get(objectId)
    if (!object || !object.notes[nodeId]) return false

    delete object.notes[nodeId]
    object.metadata.modified = new Date().toISOString()
    this.objects.set(objectId, object)
    return true
  }

  // Version Control Operations
  async getVersionHistory(objectId: string): Promise<ZLFNVersion[]> {
    const object = this.objects.get(objectId)
    return object?.versionHistory || []
  }

  async revertToVersion(objectId: string, versionTimestamp: string): Promise<ZLFNObject | null> {
    const object = this.objects.get(objectId)
    if (!object) return null

    const version = object.versionHistory.find(v => v.timestamp === versionTimestamp)
    if (!version) return null

    // Create a new version for the revert
    const revertVersion: ZLFNVersion = {
      timestamp: new Date().toISOString(),
      markdown: version.markdown,
      zflnJson: version.zflnJson,
      notes: version.notes,
      changeType: 'reverted',
      changeDescription: `Reverted to version from ${version.timestamp}`,
      parentVersion: versionTimestamp
    }

    return this.updateObject(objectId, {
      markdown: version.markdown,
      zflnJson: version.zflnJson,
      notes: version.notes,
      versionHistory: [...object.versionHistory, revertVersion]
    })
  }

  // Create a snapshot/version without changing content (e.g., layout saved)
  async createSnapshot(objectId: string, changeDescription: string, changeType: ZLFNVersion['changeType'] = 'modified', author?: string): Promise<ZLFNObject | null> {
    const object = this.objects.get(objectId)
    if (!object) return null

    const snapshot: ZLFNVersion = {
      timestamp: new Date().toISOString(),
      markdown: object.markdown,
      zflnJson: object.zflnJson,
      notes: object.notes,
      changeType,
      changeDescription,
      author
    }

    if (object.versionHistory.length >= 20) {
      object.versionHistory.shift()
    }
    object.versionHistory.push(snapshot)
    object.metadata.modified = new Date().toISOString()
    this.objects.set(objectId, object)
    return object
  }

  // Conflict Detection and Resolution
  private detectConflicts(existing: ZLFNStructure, incoming: ZLFNStructure): Conflict[] {
    const conflicts: Conflict[] = []
    
    // Check for duplicate node IDs across all arguments
    const existingNodeIds = new Set(
      existing.arguments.flatMap(arg => 
        arg.zones.flatMap(zone => zone.nodes.map(node => node.id))
      )
    )
    
    incoming.arguments.forEach(arg => {
      arg.zones.forEach(zone => {
        zone.nodes.forEach(node => {
          if (existingNodeIds.has(node.id)) {
            conflicts.push({
              type: 'duplicate_id',
              nodeId: node.id,
              existingValue: existing,
              incomingValue: node,
              suggestedResolution: 'suffix',
              description: `Node ID '${node.id}' already exists`
            })
          }
        })
      })
    })

    return conflicts
  }

  private async mergeZLFNStructures(
    existing: ZLFNStructure, 
    incoming: ZLFNStructure, 
    conflicts: Conflict[], 
    options: MergeOptions
  ): Promise<MergeResult & { mergedStructure?: ZLFNStructure }> {
    const resolvedConflicts: ConflictResolution[] = []
    const newNotesMappings: Record<string, string> = {}
    const warnings: string[] = []
    
    // Clone existing structure
    const merged: ZLFNStructure = JSON.parse(JSON.stringify(existing))
    
    // Handle conflicts based on strategy
    const processedIncoming = this.resolveConflicts(incoming, conflicts, options.strategy, resolvedConflicts, newNotesMappings)
    
    // Merge arguments
    if (options.strategy === 'merge') {
      merged.arguments.push(...processedIncoming.arguments)
    } else if (options.strategy === 'overwrite') {
      merged.arguments = processedIncoming.arguments
    }

    // Update metadata
    merged.metadata = {
      version: this.incrementVersion(merged.metadata?.version || '1.0.0'),
      created: merged.metadata?.created || new Date().toISOString(),
      modified: new Date().toISOString(),
      schema: merged.metadata?.schema || 'zlfn-v1.0'
    }

    return {
      success: true,
      mergedArguments: processedIncoming.arguments.length,
      resolvedConflicts,
      newNotesMappings,
      warnings,
      errors: [],
      mergedStructure: merged
    }
  }

  private resolveConflicts(
    structure: ZLFNStructure, 
    conflicts: Conflict[], 
    strategy: MergeOptions['strategy'],
    resolvedConflicts: ConflictResolution[],
    notesMappings: Record<string, string>
  ): ZLFNStructure {
    const processed = JSON.parse(JSON.stringify(structure))
    
    conflicts.forEach(conflict => {
      if (conflict.type === 'duplicate_id' && conflict.nodeId) {
        if (strategy === 'suffix') {
          const newId = this.generateUniqueId(conflict.nodeId)
          
          // Update all references to this node
          processed.arguments.forEach((arg: any) => {
            arg.zones.forEach((zone: any) => {
              zone.nodes.forEach((node: any) => {
                if (node.id === conflict.nodeId) {
                  node.id = newId
                }
              })
            })
            
            // Update dependencies
            arg.dependencies.forEach((dep: any) => {
              if (dep.sourceId === conflict.nodeId) dep.sourceId = newId
              if (dep.targetId === conflict.nodeId) dep.targetId = newId
            })
          })
          
          // Track mapping for notes
          notesMappings[conflict.nodeId] = newId
          
          resolvedConflicts.push({
            type: 'id_conflict',
            description: `Renamed '${conflict.nodeId}' to '${newId}' to resolve conflict`,
            resolution: 'suffix',
            affectedNodes: [newId],
            timestamp: new Date().toISOString()
          })
        }
      }
    })
    
    return processed
  }

  // Utility Methods
  private generateId(): string {
    return `zlfn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateUniqueId(baseId: string): string {
    let counter = 1
    let newId = `${baseId}_${counter}`
    
    // Check against all existing objects
    while (this.idExists(newId)) {
      counter++
      newId = `${baseId}_${counter}`
    }
    
    return newId
  }

  private idExists(id: string): boolean {
    for (const object of this.objects.values()) {
      const exists = object.zflnJson.arguments.some(arg =>
        arg.zones.some(zone =>
          zone.nodes.some(node => node.id === id)
        )
      )
      if (exists) return true
    }
    return false
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number)
    parts[2] = (parts[2] || 0) + 1
    return parts.join('.')
  }

  private remapNotes(notes: Record<string, string>, mappings: Record<string, string>): Record<string, string> {
    const remapped = { ...notes }
    
    Object.entries(mappings).forEach(([oldId, newId]) => {
      if (remapped[oldId]) {
        remapped[newId] = remapped[oldId]
        delete remapped[oldId]
      }
    })
    
    return remapped
  }

  private generateChangeDescription(previous: ZLFNObject, updates: Partial<ZLFNObject>): string {
    const changes: string[] = []
    
    if (updates.markdown && updates.markdown !== previous.markdown) {
      changes.push('markdown content')
    }
    
    if (updates.zflnJson) {
      changes.push('ZLFN structure')
    }
    
    if (updates.notes) {
      changes.push('notes')
    }
    
    return `Updated ${changes.join(', ') || 'metadata'}`
  }

  // File Validation
  private async validateUpload(file: File): Promise<UploadValidation> {
    const validation: UploadValidation = {
      isValid: true,
      fileType: 'unknown',
      size: file.size,
      errors: [],
      warnings: []
    }

    // Size validation (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      validation.isValid = false
      validation.errors.push('File size exceeds 10MB limit')
    }

    // Type validation
    if (file.name.endsWith('.md') || file.type === 'text/markdown') {
      validation.fileType = 'markdown'
    } else if (file.name.endsWith('.json') || file.type === 'application/json') {
      validation.fileType = 'json'
    } else {
      validation.isValid = false
      validation.errors.push('Unsupported file type. Only .md and .json files are allowed')
    }

    return validation
  }

  private validateZLFNStructure(structure: ZLFNStructure): { isValid: boolean; warnings: string[]; errors: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic structure validation
    if (!structure.arguments || !Array.isArray(structure.arguments)) {
      errors.push('Missing or invalid arguments array')
    }

    structure.arguments?.forEach((arg, index) => {
      if (!arg.core) {
        errors.push(`Argument ${index}: Missing core section`)
      }
      
      if (!arg.zones || !Array.isArray(arg.zones)) {
        errors.push(`Argument ${index}: Missing or invalid zones array`)
      }
      
      if (!arg.dependencies || !Array.isArray(arg.dependencies)) {
        warnings.push(`Argument ${index}: Missing dependencies array`)
      }
    })

    return {
      isValid: errors.length === 0,
      warnings,
      errors
    }
  }

  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = (_e) => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  // Lock Management
  acquireLock(objectId: string, userId: string, duration: number = 300000): boolean { // 5 minutes default
    if (this.isLocked(objectId)) {
      return false
    }
    
    this.locks.set(objectId, {
      userId,
      expires: Date.now() + duration
    })
    
    return true
  }

  releaseLock(objectId: string, userId: string): boolean {
    const lock = this.locks.get(objectId)
    if (lock && lock.userId === userId) {
      this.locks.delete(objectId)
      return true
    }
    return false
  }

  private isLocked(objectId: string): boolean {
    const lock = this.locks.get(objectId)
    if (!lock) return false
    
    if (Date.now() > lock.expires) {
      this.locks.delete(objectId)
      return false
    }
    
    return true
  }

  // Export functionality
  async exportObject(objectId: string, format: 'json' | 'markdown' | 'full' = 'full'): Promise<string | null> {
    const object = this.objects.get(objectId)
    if (!object) return null

    switch (format) {
      case 'json':
        return JSON.stringify(object.zflnJson, null, 2)
      case 'markdown':
        return object.markdown
      case 'full':
        return JSON.stringify(object, null, 2)
      default:
        return null
    }
  }

  // Get all objects (for listing)
  getAllObjects(): ZLFNObject[] {
    return Array.from(this.objects.values())
  }

  // Search functionality
  searchObjects(query: string): ZLFNObject[] {
    const searchTerm = query.toLowerCase()
    return this.getAllObjects().filter(obj => 
      obj.markdown.toLowerCase().includes(searchTerm) ||
      obj.metadata.title?.toLowerCase().includes(searchTerm) ||
      obj.metadata.description?.toLowerCase().includes(searchTerm) ||
      Object.values(obj.notes).some(note => note.toLowerCase().includes(searchTerm))
    )
  }
}

// Singleton instance
export const zlfnObjectManager = new ZLFNObjectManager()
