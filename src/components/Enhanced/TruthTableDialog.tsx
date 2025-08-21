import React from 'react'
import EnhancedDialog from './EnhancedDialog'
import EnhancedTruthTable from './EnhancedTruthTable'
import type { AstNodeRec } from '../../services/logic'

interface TruthTableDialogProps {
  open: boolean
  onClose: () => void
  ast: AstNodeRec
  expression?: string
  nodeId?: string
}

export const TruthTableDialog: React.FC<TruthTableDialogProps> = ({
  open,
  onClose,
  ast,
  expression,
  nodeId
}) => {
  const handleExport = () => {
    // Export functionality will be handled by the EnhancedTruthTable component
    console.log('Exporting truth table for node:', nodeId)
  }

  return (
    <EnhancedDialog
      open={open}
      onClose={onClose}
      title="Truth Table Analysis"
      subtitle={nodeId ? `Logical Evaluation for ${nodeId}` : 'Logical Evaluation'}
      onExport={handleExport}
      maxWidth="xl"
    >
      <EnhancedTruthTable
        ast={ast}
        expression={expression}
        onExport={handleExport}
      />
    </EnhancedDialog>
  )
}

export default TruthTableDialog
