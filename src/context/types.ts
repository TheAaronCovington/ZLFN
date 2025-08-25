import type { AstNodeRec } from '../services/logic'
import type { ZlfnNode, ZlfnEdge } from '../components/Visualizations/ZlfnGraph/types'
import type { ArgumentData } from '../components/Visualizations/ArgumentTableau/types'

export type NodeIdToActive = Record<string, boolean>

export type LogicMode =
  | 'classical'
  | 'epistemic'
  | 'deontic'
  | 'temporal'
  | 'informal'
  | 'paraconsistent'
  | 'fuzzy'

export type NodeState = { value: 'T' | 'F' | 'B' | number; weight?: number }

export type Note = {
  id: string
  text: string
  createdAt: string
  updatedAt?: string
  author?: string
}

export type SharedArgument = {
  id: string
  title: string
  markdown: { documentId: string; content: string }
  expressions: string[]
  ast?: AstNodeRec
  zlfnGraph?: { nodes: ZlfnNode[]; edges: ZlfnEdge[] }
  atn?: ArgumentData
  refs?: Record<string, string>
  notes?: Record<string, Note[]>
  // Core metadata for multi-core JSON imports
  coreMetadata?: {
    importId: string      // Groups cores from same JSON import
    coreIndex: number     // Position within the import (0, 1, 2...)
    coreName: string      // Display name for this core
    coreCount: number     // Total number of cores in this import
  }
}

export type UnifiedData = {
  activeSource: 'document' | 'expression' | 'imported'
  arguments: SharedArgument[]
  selectedArgumentId: string | null
}


