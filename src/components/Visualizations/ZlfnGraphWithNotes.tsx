/**
 * ZLFN Graph with Notes Integration
 * Wrapper component that adds notes functionality to the existing ZlfnGraph
 */

import React from 'react'
import { ZlfnGraph, type ZlfnGraphProps } from './ZlfnGraph'
import NotesDialog from '../Notes/NotesDialog'

interface ZlfnGraphWithNotesProps extends ZlfnGraphProps {
  objectId?: string
  showNotesIndicators?: boolean
}

export function ZlfnGraphWithNotes({
  objectId = 'default-graph',
  showNotesIndicators = true,
  ...graphProps
}: ZlfnGraphWithNotesProps) {
  const [notesEnabled, setNotesEnabled] = React.useState(showNotesIndicators)
  const [notesOpen, setNotesOpen] = React.useState(false)
  const [activeNodeId, setActiveNodeId] = React.useState<string | null>(null)

  const handleNotesToggle = React.useCallback(() => setNotesEnabled(prev => !prev), [])
  const handleNoteRequest = React.useCallback((nodeId: string) => {
    setActiveNodeId(nodeId)
    setNotesOpen(true)
  }, [])

  return (
    <React.Fragment>
      <ZlfnGraph {...graphProps} onNotesToggle={handleNotesToggle} notesEnabled={notesEnabled} onNoteRequest={handleNoteRequest} />
      <NotesDialog open={notesOpen} onClose={() => setNotesOpen(false)} node={activeNodeId ? ({ id: activeNodeId } as any) : null} objectId={objectId} />
    </React.Fragment>
  )
}

export default ZlfnGraphWithNotes;
