/**
 * ZLFN Graph with Notes Integration
 * Wrapper component that adds notes functionality to the existing ZlfnGraph
 */

import React from 'react'
import { ZlfnGraph, type ZlfnGraphProps } from './ZlfnGraph'
import NotesDialog from '../Notes/NotesDialog'
import useD3Notes from '../../hooks/useD3Notes'
import { api } from '../../services/zlfnAPI'
import * as d3 from 'd3'

interface ZlfnGraphWithNotesProps extends ZlfnGraphProps {
  objectId?: string
  showNotesIndicators?: boolean
}

export function ZlfnGraphWithNotes({
  objectId = 'default-graph',
  showNotesIndicators = true,
  nodes = [],
  ...graphProps
}: ZlfnGraphWithNotesProps) {
  const [notesEnabled, setNotesEnabled] = React.useState(showNotesIndicators)
  const [notesOpen, setNotesOpen] = React.useState(false)
  const [activeNodeId, setActiveNodeId] = React.useState<string | null>(null)
  const [collabCount] = React.useState<number>(0)

  const svgRef = React.useRef<SVGSVGElement | null>(null)

  const handleNotesToggle = React.useCallback(() => setNotesEnabled(prev => !prev), [])
  const handleNoteRequest = React.useCallback((nodeId: string) => {
    setActiveNodeId(nodeId)
    setNotesOpen(true)
  }, [])

  // Canvas-level note indicators with tooltip/edit
  const { addNoteIndicators, updateNoteIndicators, updateNoteIndicator, removeNoteIndicators } = useD3Notes({
    svgRef,
    nodes: nodes as any[],
    objectId,
    onNoteEdit: (node) => {
      setActiveNodeId(node?.id)
      setNotesOpen(true)
    },
    getNoteContent: (nodeId: string) => {
      try {
        const raw = localStorage.getItem(`zlfn_notes_${objectId}`) || '{}'
        const map = JSON.parse(raw) as Record<string, string>
        return map[nodeId] || ''
      } catch { return '' }
    },
    hasNote: (nodeId: string) => {
      try {
        const raw = localStorage.getItem(`zlfn_notes_${objectId}`) || '{}'
        const map = JSON.parse(raw) as Record<string, string>
        return Boolean((map[nodeId] || '').trim())
      } catch { return false }
    }
  })

  React.useEffect(() => {
    let updateInterval: number | undefined
    let bootstrapInterval: number | undefined
    let bootstrapTimeout: number | undefined

    if (notesEnabled) {
      const tryAdd = () => addNoteIndicators()
      tryAdd()
      // A couple of quick retries to catch late node mounting
      const t1 = window.setTimeout(tryAdd, 100)
      const t2 = window.setTimeout(tryAdd, 300)

      // Bootstrap: briefly poll until indicators exist for most nodes, then stop
      bootstrapInterval = window.setInterval(() => {
        if (!svgRef.current) return
        const svg = d3.select(svgRef.current)
        const indicatorCount = svg.selectAll('.note-indicator').nodes().length
        const nodeCount = Math.max(0, nodes?.length || 0)
        if (indicatorCount < nodeCount) {
          tryAdd()
        } else {
          if (bootstrapInterval) window.clearInterval(bootstrapInterval)
          bootstrapInterval = undefined
        }
      }, 200)

      // Safety: stop bootstrap polling after 2 seconds max
      bootstrapTimeout = window.setTimeout(() => {
        if (bootstrapInterval) window.clearInterval(bootstrapInterval)
        bootstrapInterval = undefined
      }, 2000)

      // Update marker positions periodically to follow node motion/drag
      updateInterval = window.setInterval(() => {
        updateNoteIndicators()
      }, 150)

      return () => {
        window.clearTimeout(t1)
        window.clearTimeout(t2)
      }
    } else {
      removeNoteIndicators()
    }

    return () => {
      if (updateInterval) window.clearInterval(updateInterval)
      if (bootstrapInterval) window.clearInterval(bootstrapInterval)
      if (bootstrapTimeout) window.clearTimeout(bootstrapTimeout)
      removeNoteIndicators()
    }
  }, [notesEnabled, nodes, addNoteIndicators, updateNoteIndicators, removeNoteIndicators])

  const handleExportFull = React.useCallback(async () => {
    try {
      const res = await api.exportObject(objectId, 'full')
      if (res.success && res.data) {
        api.downloadFile(`${objectId}.json`, res.data, 'application/json')
      }
    } catch (e) {
      console.error(e)
    }
  }, [objectId])

  const handleImportFull = React.useCallback(async (file: File) => {
    try {
      await api.uploadFile(file, objectId)
    } catch (e) {
      console.error(e)
    }
  }, [objectId])

  return (
    <React.Fragment>
      <ZlfnGraph
        {...graphProps}
        nodes={nodes}
        onNotesToggle={handleNotesToggle}
        notesEnabled={notesEnabled}
        onNoteRequest={handleNoteRequest}
        externalSvgRef={svgRef}
        suppressInternalNoteMarkers={true}
        onExportFull={handleExportFull}
        onImportFull={handleImportFull}
        collabCount={collabCount}
      />
      <NotesDialog
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        node={activeNodeId ? ({ id: activeNodeId } as any) : null}
        objectId={objectId}
        onNoteChange={(nodeId, hasNote) => updateNoteIndicator(nodeId, hasNote)}
      />
    </React.Fragment>
  )
}

export default ZlfnGraphWithNotes;
