/**
 * Phase 2 Demo Page
 * Showcases enhanced UI components and real-time features
 */

import React from 'react'
import { Box, Typography, Tab, Tabs, Button } from '@mui/material'
import { ZlfnGraphWithNotes } from '../components/Visualizations/ZlfnGraphWithNotes'
import { FileManager } from '../components/FileUpload/FileManager'
import { ZLFNProvider, useZLFN } from '../context/ZLFNContext'
import VersionHistory from '../components/VersionControl/VersionHistory'
import DiffViewer from '../components/VersionControl/DiffViewer'
import NeonCard from '../components/UI/NeonCard'
import APISwitcher from '../components/Settings/APISwitcher'

const Phase2Demo: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState('graph')
  const [viewingDiff, setViewingDiff] = React.useState<{ base: string; compare: string } | null>(null)
  const [diffOpen, setDiffOpen] = React.useState(false)

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue)
  }


  const handleViewDiff = (compareVersionId: string) => {
    // compareVersionId is a versionKey (index as string) from VersionHistory
    const compareIndex = Number(compareVersionId)
    const baseIndex = Math.max(0, compareIndex + 1) // previous version as base, latest is index 0
    setViewingDiff({ base: String(baseIndex), compare: String(compareIndex) })
    setDiffOpen(true)
  }

  const sampleNodes = [{ id: 'P1', label: 'P1', type: 'premise' as const, color: '#20B2AA', size: { width: 80, height: 30 } }];
  const sampleEdges = [] as any[];

  return (
    <ZLFNProvider enableCollaboration={true}>
      <Box sx={{ maxWidth: 1600, margin: '0 auto', p: 2 }}>
        <Typography variant="h4" sx={{ mb: 2, color: '#40c4ff' }}>
          ZLFN Advanced Features Demo
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Graph with Notes" value="graph" />
            <Tab label="File Manager" value="fileManager" />
            <Tab label="Version Control" value="versionControl" />
            <Tab label="API Settings" value="apiSettings" />
            <Tab label="Collaboration" value="collaboration" />
          </Tabs>
        </Box>

        {activeTab === 'graph' && (
          <NeonCard title="Graph with Notes Demo">
            <Box sx={{ height: '70vh' }}>
              <ZlfnGraphWithNotes
                nodes={sampleNodes}
                edges={sampleEdges}
                storageKey="phase2-demo"
                objectId="sample-object-1"
              />
            </Box>
          </NeonCard>
        )}

        {activeTab === 'fileManager' && (
          <NeonCard title="File Upload and Management">
            <FileManager objectId="sample-object-1" />
          </NeonCard>
        )}

        {activeTab === 'versionControl' && (
          <NeonCard title="Version Control">
            {diffOpen && viewingDiff ? (
              <DiffViewer
                objectId="sample-object-1"
                baseVersionId={viewingDiff.base}
                compareVersionId={viewingDiff.compare}
                onClose={() => setDiffOpen(false)}
              />
            ) : (
              <VersionHistory
                objectId="sample-object-1"
                onViewDiff={handleViewDiff}
              />
            )}
          </NeonCard>
        )}

        {activeTab === 'apiSettings' && (
          <NeonCard title="API Configuration">
            <APISwitcher />
          </NeonCard>
        )}

        {activeTab === 'collaboration' && (
          <NeonCard title="Real-Time Collaboration">
            <CollaborationDemo />
          </NeonCard>
        )}
      </Box>
    </ZLFNProvider>
  )
}

const CollaborationDemo = () => {
  const { state, updatePresence } = useZLFN()
  const [isEditing, setIsEditing] = React.useState(false)

  const handleToggleEdit = async () => {
    const newEditingState = !isEditing
    setIsEditing(newEditingState)

    if (newEditingState) {
      updatePresence('editing')
    } else {
      updatePresence(undefined)
    }
  }

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ color: '#8ad7ff', mb: 2 }}>
        Simulated User Presence
      </Typography>
      <pre style={{ color: 'white', backgroundColor: 'black', padding: '10px', borderRadius: '4px' }}>
        {JSON.stringify(state.collaboration, null, 2)}
      </pre>
      <Button
        variant="contained"
        onClick={handleToggleEdit}
        sx={{ mt: 2 }}
      >
        {isEditing ? 'Release Edit Lock' : 'Acquire Edit Lock'}
      </Button>
    </Box>
  )
}

export default Phase2Demo
