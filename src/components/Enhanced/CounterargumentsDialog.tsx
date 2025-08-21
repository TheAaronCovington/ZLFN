import React from 'react'
import { EnhancedDialog } from './EnhancedDialog'
import { EnhancedCounterarguments, type CounterargumentData } from './EnhancedCounterarguments'

interface CounterargumentsDialogProps {
  open: boolean
  onClose: () => void
  data?: CounterargumentData
  expression?: string
  nodeId?: string
}

// Generate sample counterargument data if none provided
const generateSampleData = (nodeId: string, expression: string): CounterargumentData => {
  return {
    mainArgument: {
      id: 'main',
      label: nodeId || 'Main',
      type: 'conclusion',
      content: expression || 'Main argument conclusion',
      strength: 0.8
    },
    nodes: [
      {
        id: 'premise1',
        label: 'P1',
        type: 'premise',
        content: 'Supporting premise',
        strength: 0.7
      },
      {
        id: 'premise2', 
        label: 'P2',
        type: 'premise',
        content: 'Additional premise',
        strength: 0.6
      },
      {
        id: 'main',
        label: nodeId || 'Main',
        type: 'conclusion',
        content: expression || 'Main argument conclusion',
        strength: 0.8
      },
      {
        id: 'counter1',
        label: 'C1',
        type: 'counterargument',
        content: 'Primary counterargument',
        strength: 0.6
      },
      {
        id: 'counter2',
        label: 'C2', 
        type: 'counterargument',
        content: 'Secondary counterargument',
        strength: 0.4
      },
      {
        id: 'rebuttal1',
        label: 'R1',
        type: 'rebuttal',
        content: 'Rebuttal to counter1',
        strength: 0.5
      }
    ],
    relationships: [
      {
        source: 'premise1',
        target: 'main',
        type: 'supports',
        strength: 0.8,
        rule: 'Modus Ponens'
      },
      {
        source: 'premise2',
        target: 'main', 
        type: 'supports',
        strength: 0.7,
        rule: 'Conjunction'
      },
      {
        source: 'counter1',
        target: 'main',
        type: 'attacks',
        strength: 0.6,
        rule: 'Counterexample'
      },
      {
        source: 'counter2',
        target: 'premise1',
        type: 'undercuts',
        strength: 0.4,
        rule: 'Undercutting Defeater'
      },
      {
        source: 'rebuttal1',
        target: 'counter1',
        type: 'rebuts',
        strength: 0.5,
        rule: 'Rebutting Defeater'
      }
    ],
    conflicts: [
      {
        id: 'conflict1',
        nodes: ['main', 'counter1'],
        severity: 'high',
        description: 'Direct contradiction between main conclusion and primary counterargument'
      },
      {
        id: 'conflict2', 
        nodes: ['premise1', 'counter2'],
        severity: 'medium',
        description: 'Undermining attack on supporting premise'
      }
    ],
    fallacies: [
      {
        id: 'fallacy1',
        type: 'Ad Hominem',
        description: 'Attack on the person rather than the argument',
        severity: 'major',
        affectedNodes: ['counter2']
      }
    ]
  }
}

export const CounterargumentsDialog: React.FC<CounterargumentsDialogProps> = ({
  open,
  onClose,
  data,
  expression = '',
  nodeId = ''
}) => {
  const counterargumentData = data || generateSampleData(nodeId, expression)
  
  

  const handleExport = () => {
    console.log('Exporting counterarguments analysis...')
  }

  return (
    <EnhancedDialog
      open={open}
      onClose={onClose}
      title="Counterargument Analysis"
      subtitle={`Logical conflicts and dialectical structure for ${nodeId || 'selected argument'}`}
      maxWidth="xl"
      fullWidth
    >
      <EnhancedCounterarguments
        data={counterargumentData}
        expression={expression}
        nodeId={nodeId}
        onExport={handleExport}
      />
    </EnhancedDialog>
  )
}

export default CounterargumentsDialog
