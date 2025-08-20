/**
 * Enhanced ZLFN Type Definitions
 * Comprehensive TypeScript interfaces for the enhanced ZLFN system
 * with markdown integration, notes, version control, and collaboration features
 */

// Core ZLFN Structure Interfaces
export interface ZLFNNode {
  id: string
  name: string
  symbolic: string
  translation: string
  type: 'premise' | 'conclusion' | 'term' | 'fallacy' | 'core' | 'assumption' | 'counterexample'
  vennRelevant: boolean
  timelineRelevant: boolean
  facets: string[]
  markdownRef?: string // Optional field for linking to markdown sections
  position?: { x: number; y: number } // D3 positioning
  metadata?: {
    confidence?: number
    certainty?: 'certain' | 'probable' | 'possible' | 'uncertain'
    source?: string
    created?: string
    modified?: string
  }
}

export interface ZLFNZone {
  name: string
  range: { xMin: number; xMax: number; yMin?: number; yMax?: number }
  color: string
  nodes: ZLFNNode[]
  description?: string
  layoutMode?: 'grid' | 'circular' | 'force' | 'hierarchical'
}

export interface ZLFNDependency {
  id: string
  source: string
  target: string
  rule: string
  context: string
  weight?: number
  type?: string
  priority: number
  bidirectional?: boolean
  metadata?: {
    confidence?: number
    strength?: 'weak' | 'moderate' | 'strong'
    evidence?: string[]
  }
}

export interface ZLFNCore {
  name: string
  summary: string
  layoutMode: 'network' | 'hierarchical' | 'circular' | 'force-directed'
  variables: Record<string, any>
  metadata: {
    confidence: number
    uncertain: string[]
    domain?: string
    complexity?: 'simple' | 'moderate' | 'complex'
    status?: 'draft' | 'review' | 'final'
  }
}

export interface ZLFNModes {
  propositional: boolean
  predicate: boolean
  epistemic: boolean
  deontic: boolean
  temporal: boolean
  informal: boolean
  paraconsistent: boolean
  fuzzy: boolean
}

export interface ZLFNCounterargument {
  name: string
  summary: string
  facets: string[]
  dependencies: ZLFNDependency[]
  strength?: 'weak' | 'moderate' | 'strong'
  refutation?: string
  metadata?: {
    source?: string
    confidence?: number
  }
}

export interface ZLFNValidation {
  errors: Array<{
    code: string
    message: string
    nodeId?: string
    dependencyId?: string
    severity: 'error' | 'warning' | 'info'
  }>
  warnings: Array<{
    code: string
    message: string
    nodeId?: string
    dependencyId?: string
    suggestion?: string
  }>
  lastValidated?: string
  isValid?: boolean
}

export interface ZLFNPagination {
  page: number
  total: number
  pageSize?: number
  hasNext?: boolean
  hasPrevious?: boolean
}

export interface ZLFNArgument {
  core: ZLFNCore
  zones: ZLFNZone[]
  dependencies: ZLFNDependency[]
  modes: ZLFNModes
  counterarguments: ZLFNCounterargument[]
  subarguments: ZLFNArgument[]
  validation: ZLFNValidation
  pagination: ZLFNPagination
  metadata?: {
    created?: string
    modified?: string
    author?: string
    version?: string
    tags?: string[]
  }
}

export interface ZLFNStructure {
  arguments: ZLFNArgument[]
  metadata?: {
    version: string
    created: string
    modified: string
    schema: string
  }
}

// Version Control Interfaces
export interface ZLFNVersion {
  timestamp: string
  markdown: string
  zflnJson: ZLFNStructure
  notes: Record<string, string>
  author?: string
  changeDescription?: string
  changeType?: 'created' | 'modified' | 'merged' | 'imported' | 'reverted'
  parentVersion?: string
  conflictsResolved?: ConflictResolution[]
  layout?: Record<string, { x: number; y: number }>
}

export interface ConflictResolution {
  type: 'id_conflict' | 'structure_conflict' | 'note_conflict'
  description: string
  resolution: 'merge' | 'overwrite' | 'suffix' | 'manual'
  affectedNodes?: string[]
  timestamp: string
}

// Enhanced ZLFN Object (Main Container)
export interface ZLFNObject {
  id: string
  markdown: string
  zflnJson: ZLFNStructure
  notes: Record<string, string> // nodeId -> note content
  versionHistory: ZLFNVersion[]
  metadata: {
    created: string
    modified: string
    fileReferences: string[]
    title?: string
    description?: string
    author?: string
    collaborators?: string[]
    status?: 'draft' | 'review' | 'published'
    isLocked?: boolean
    lockHolder?: string
    lockExpiry?: string
  }
  permissions?: {
    canEdit: boolean
    canDelete: boolean
    canShare: boolean
    canExport: boolean
  }
}

// Import/Export Interfaces
export interface ImportResult {
  success: boolean
  objectId?: string
  conflicts?: Conflict[]
  mergedArguments?: number
  warnings?: string[]
  errors?: string[]
}

export interface Conflict {
  type: 'duplicate_id' | 'structural_mismatch' | 'invalid_reference'
  nodeId?: string
  existingValue: any
  incomingValue: any
  suggestedResolution?: 'merge' | 'suffix' | 'overwrite'
  description: string
}

export interface MergeOptions {
  strategy: 'merge' | 'overwrite' | 'suffix'
  preserveNotes: boolean
  validateStructure: boolean
  createBackup: boolean
}

export interface MergeResult {
  success: boolean
  mergedArguments: number
  resolvedConflicts: ConflictResolution[]
  newNotesMappings: Record<string, string>
  warnings: string[]
  errors: string[]
  backupVersionId?: string
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  warnings?: string[]
  metadata?: {
    timestamp: string
    version: string
    requestId: string
  }
}

// File Upload Types
export interface FileUploadOptions {
  maxSize: number // in bytes
  allowedTypes: string[]
  validateContent: boolean
  sanitizeMarkdown: boolean
}

export interface UploadValidation {
  isValid: boolean
  fileType: 'markdown' | 'json' | 'unknown'
  size: number
  errors: string[]
  warnings: string[]
}

// Notes System Types
export interface NodeNote {
  nodeId: string
  content: string
  created: string
  modified: string
  author?: string
  isPrivate?: boolean
  tags?: string[]
}

export interface NotesState {
  notes: Record<string, string>
  selectedNoteId: string | null
  isEditing: boolean
  isDirty: boolean
}

// Real-time Collaboration Types
export interface CollaborationState {
  isCollaborating: boolean
  activeUsers: CollaborationUser[]
  userPresence: Record<string, {
    lastSeen: number
    isEditing: boolean
  }>
  editLocks: Record<string, { userId: string; expires: number }>
}

export interface CollaborationUser {
  id: string
  name: string
  avatar?: string
  lastActivity: string
  isEditing?: string // nodeId or section being edited
}

export interface EditLock {
  userId: string
  nodeId: string
  type: 'note' | 'structure' | 'markdown'
  acquired: string
  expires: string
}

export interface PendingChange {
  id: string
  userId: string
  type: 'note' | 'structure' | 'markdown'
  nodeId?: string
  change: any
  timestamp: string
  status: 'pending' | 'applied' | 'conflict' | 'rejected'
}

// UI State Types
export interface ZLFNUIState {
  selectedNodes: string[]
  highlightedDependencies: string[]
  activeZone: string | null
  viewMode: 'graph' | 'table' | 'timeline' | 'hybrid'
  showNotes: boolean
  showVersionHistory: boolean
  editMode: boolean
  isLoading: boolean
  errors: string[]
}

// Utility Types
export type ZLFNNodeType = ZLFNNode['type']
export type ZLFNDependencyType = ZLFNDependency['type']
export type ChangeType = ZLFNVersion['changeType']
export type ValidationSeverity = ZLFNValidation['errors'][0]['severity']

// Default/Template Objects
export const createEmptyZLFNStructure = (): ZLFNStructure => ({
  arguments: [{
    core: {
      name: "",
      summary: "",
      layoutMode: "network",
      variables: {},
      metadata: {
        confidence: 0,
        uncertain: []
      }
    },
    zones: [{
      name: "Main",
      range: { xMin: 0, xMax: 800 },
      color: "#40c4ff",
      nodes: []
    }],
    dependencies: [],
    modes: {
      propositional: false,
      predicate: false,
      epistemic: false,
      deontic: false,
      temporal: false,
      informal: false,
      paraconsistent: false,
      fuzzy: false
    },
    counterarguments: [],
    subarguments: [],
    validation: {
      errors: [],
      warnings: []
    },
    pagination: {
      page: 1,
      total: 1
    }
  }],
  metadata: {
    version: "1.0.0",
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    schema: "zlfn-v1.0"
  }
})

export const createEmptyZLFNObject = (id: string): ZLFNObject => ({
  id,
  markdown: "",
  zflnJson: createEmptyZLFNStructure(),
  notes: {},
  versionHistory: [],
  metadata: {
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    fileReferences: [],
    status: 'draft'
  },
  permissions: {
    canEdit: true,
    canDelete: true,
    canShare: true,
    canExport: true
  }
})
