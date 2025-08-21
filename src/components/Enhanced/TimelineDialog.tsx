import React from 'react'
import EnhancedDialog from './EnhancedDialog'
import EnhancedTimeline from './EnhancedTimeline'

interface TimelineNode {
  id: string
  label: string
  type: 'premise' | 'intermediate' | 'conclusion'
  timestamp: number
  confidence: number
  rule?: string
  dependencies: string[]
}

interface TimelineEdge {
  from: string
  to: string
  rule: string
  strength: number
  timestamp: number
}

interface TimelineDialogProps {
  open: boolean
  onClose: () => void
  nodes?: TimelineNode[]
  edges?: TimelineEdge[]
  expression?: string
  nodeId?: string
}

export const TimelineDialog: React.FC<TimelineDialogProps> = ({
  open,
  onClose,
  nodes,
  edges,
  expression,
  nodeId
}) => {
  const handleExport = () => {
    // Export functionality will be handled by the EnhancedTimeline component
    console.log('Exporting timeline for node:', nodeId)
  }

  return (
    <EnhancedDialog
      open={open}
      onClose={onClose}
      title="Timeline Analysis"
      subtitle={nodeId ? `Logical Development for ${nodeId}` : 'Logical Development'}
      onExport={handleExport}
      maxWidth="xl"
    >
      <EnhancedTimeline
        nodes={nodes}
        edges={edges}
        expression={expression}
        onExport={handleExport}
      />
    </EnhancedDialog>
  )
}

export default TimelineDialog
