import React from 'react'
import EnhancedDialog from './EnhancedDialog'
import EnhancedVennDiagram from './EnhancedVennDiagram'
import type { VennDiagramData, NecessarySufficientExample } from '../Visualizations/VennDiagram'

interface VennDiagramDialogProps {
  open: boolean
  onClose: () => void
  data: VennDiagramData
  examples?: NecessarySufficientExample[]
  expression?: string
  nodeId?: string
}

export const VennDiagramDialog: React.FC<VennDiagramDialogProps> = ({
  open,
  onClose,
  data,
  examples,
  expression,
  nodeId
}) => {
  const handleExport = () => {
    // Export functionality will be handled by the EnhancedVennDiagram component
    console.log('Exporting Venn diagram for node:', nodeId)
  }

  return (
    <EnhancedDialog
      open={open}
      onClose={onClose}
      title="Venn Diagram Analysis"
      subtitle={nodeId ? `Logical Relationships for ${nodeId}` : 'Logical Relationships'}
      onExport={handleExport}
      maxWidth="xl"
    >
      <EnhancedVennDiagram
        data={data}
        examples={examples}
        expression={expression}
        onExport={handleExport}
      />
    </EnhancedDialog>
  )
}

export default VennDiagramDialog
