/**
 * Phase 2 Demo Page
 * Showcases enhanced UI components and real-time features
 */

import React, { useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  Chip,
  Alert,
  Tabs,
  Tab,
  Divider
} from '@mui/material'
import {
  Note as NoteIcon,
  CloudUpload as CloudUploadIcon,
  Merge as MergeIcon,
  Timeline as TimelineIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material'
import { ZlfnGraphWithNotes } from '../components/Visualizations/ZlfnGraphWithNotes'
import { FileManager } from '../components/FileUpload/FileManager'
import { ZLFNProvider } from '../context/ZLFNContext'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  )
}

export function Phase2Demo() {
  const [activeTab, setActiveTab] = useState(0)
  const [demoObjectId] = useState('phase2-demo-object')

  // Sample data for the graph
  const sampleNodes = [
    { 
      id: 'P1', 
      name: 'All humans are mortal', 
      type: 'premise' as const,
      color: '#20B2AA', 
      size: { width: 120, height: 40 },
      argumentId: 'Demo'
    },
    { 
      id: 'P2', 
      name: 'Socrates is human', 
      type: 'premise' as const,
      color: '#20B2AA', 
      size: { width: 120, height: 40 },
      argumentId: 'Demo'
    },
    { 
      id: 'C1', 
      name: 'Socrates is mortal', 
      type: 'conclusion' as const,
      color: '#9370DB', 
      size: { width: 120, height: 40 },
      argumentId: 'Demo'
    }
  ]

  const sampleEdges = [
    { from: 'P1', to: 'C1', weight: 90, style: 'solid' as const, rule: 'Universal Instantiation' },
    { from: 'P2', to: 'C1', weight: 95, style: 'solid' as const, rule: 'Modus Ponens' }
  ]

  return (
    <ZLFNProvider>
      <Box sx={{ p: 3, minHeight: '100vh', bgcolor: '#0a0a0a' }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ color: '#40c4ff', fontWeight: 600, mb: 1 }}>
            🚀 ZLFN Phase 2 Demo
          </Typography>
          <Typography variant="h6" sx={{ color: '#b0bec5', mb: 2 }}>
            Enhanced UI Components & Real-time Features
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip icon={<NoteIcon />} label="Notes Integration" color="success" />
            <Chip icon={<CloudUploadIcon />} label="File Upload" color="info" />
            <Chip icon={<MergeIcon />} label="Conflict Resolution" color="warning" />
            <Chip icon={<TimelineIcon />} label="Version Control" color="secondary" />
          </Box>
        </Box>

        {/* Main Content */}
        <Paper sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              '& .MuiTab-root': { color: '#b0bec5' },
              '& .Mui-selected': { color: '#40c4ff' }
            }}
          >
            <Tab icon={<VisibilityIcon />} label="Graph with Notes" iconPosition="start" />
            <Tab icon={<CloudUploadIcon />} label="File Manager" iconPosition="start" />
            <Tab icon={<MergeIcon />} label="Merge & Conflicts" iconPosition="start" />
          </Tabs>

          {/* Graph with Notes Tab */}
          <TabPanel value={activeTab} index={0}>
            <Box sx={{ p: 3 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>Interactive Notes Demo:</strong> The graph below shows note indicators (📝) next to nodes. 
                  Click the note toggle button to enable/disable notes, then click the indicators to add or edit notes.
                </Typography>
              </Alert>

              <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', height: 600 }}>
                <CardContent sx={{ height: '100%', p: 0 }}>
                  <ZlfnGraphWithNotes
                    nodes={sampleNodes}
                    edges={sampleEdges}
                    objectId={demoObjectId}
                    showNotesIndicators={true}
                    onNotesToggle={(enabled) => console.log('Notes toggled:', enabled)}
                  />
                </CardContent>
              </Card>

              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" sx={{ color: '#40c4ff', mb: 1 }}>
                  Features Demonstrated:
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: '1 1 300px', p: 2, bgcolor: 'rgba(0, 230, 118, 0.1)', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: '#00e676', mb: 1 }}>
                      ✅ Notes Integration
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                      • Note indicators on graph nodes<br/>
                      • Hover tooltips with note previews<br/>
                      • Rich note editing dialog<br/>
                      • Auto-save functionality
                    </Typography>
                  </Box>
                  <Box sx={{ flex: '1 1 300px', p: 2, bgcolor: 'rgba(64, 196, 255, 0.1)', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: '#40c4ff', mb: 1 }}>
                      ✅ D3 Integration
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                      • Seamless D3.js integration<br/>
                      • Dynamic note indicator updates<br/>
                      • Interactive tooltips<br/>
                      • Real-time visual feedback
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </TabPanel>

          {/* File Manager Tab */}
          <TabPanel value={activeTab} index={1}>
            <Box sx={{ p: 3 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>File Upload Demo:</strong> Drag and drop .md or .json files to test the upload system. 
                  The system includes validation, progress tracking, and intelligent merging.
                </Typography>
              </Alert>

              <FileManager
                objectId={demoObjectId}
                onFileProcessed={(result) => console.log('File processed:', result)}
                showAdvancedOptions={true}
              />

              <Divider sx={{ my: 3 }} />

              <Box>
                <Typography variant="h6" sx={{ color: '#40c4ff', mb: 2 }}>
                  File Upload Features:
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: '1 1 250px', p: 2, bgcolor: 'rgba(255, 193, 7, 0.1)', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: '#ffc107', mb: 1 }}>
                      📁 Drag & Drop
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                      • Intuitive drag-drop interface<br/>
                      • Multiple file support<br/>
                      • Visual feedback<br/>
                      • File type validation
                    </Typography>
                  </Box>
                  <Box sx={{ flex: '1 1 250px', p: 2, bgcolor: 'rgba(156, 39, 176, 0.1)', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: '#9c27b0', mb: 1 }}>
                      ⚡ Progress Tracking
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                      • Real-time upload progress<br/>
                      • Status indicators<br/>
                      • Error handling<br/>
                      • Success notifications
                    </Typography>
                  </Box>
                  <Box sx={{ flex: '1 1 250px', p: 2, bgcolor: 'rgba(244, 67, 54, 0.1)', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: '#f44336', mb: 1 }}>
                      🔍 Validation
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                      • File size limits<br/>
                      • Type checking<br/>
                      • Content validation<br/>
                      • Security measures
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </TabPanel>

          {/* Merge & Conflicts Tab */}
          <TabPanel value={activeTab} index={2}>
            <Box sx={{ p: 3 }}>
              <Alert severity="warning" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>Conflict Resolution Demo:</strong> This section demonstrates how the system handles 
                  conflicts when merging files with duplicate IDs or structural mismatches.
                </Typography>
              </Alert>

              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 400px' }}>
                  <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: '#ffc107', mb: 2 }}>
                        Merge Strategies
                      </Typography>
                      
                      <Box sx={{ mb: 2 }}>
                        <Chip label="Merge" color="success" sx={{ mr: 1, mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                          Combines new content with existing data
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        <Chip label="Suffix" color="warning" sx={{ mr: 1, mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                          Adds content with modified IDs to avoid conflicts
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        <Chip label="Overwrite" color="error" sx={{ mr: 1, mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                          Replaces existing data entirely (destructive)
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>

                <Box sx={{ flex: '1 1 400px' }}>
                  <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: '#f44336', mb: 2 }}>
                        Conflict Types
                      </Typography>
                      
                      <Box sx={{ mb: 2 }}>
                        <Chip label="ID Conflicts" color="warning" sx={{ mr: 1, mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                          Duplicate node IDs between files
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        <Chip label="Structural" color="error" sx={{ mr: 1, mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                          Incompatible data structures
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mb: 2 }}>
                        <Chip label="References" color="info" sx={{ mr: 1, mb: 1 }} />
                        <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                          Invalid cross-references
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              </Box>

              <Box sx={{ mt: 3 }}>
                <Button
                  variant="outlined"
                  startIcon={<MergeIcon />}
                  onClick={() => alert('This would open the merge options dialog with sample conflicts')}
                  sx={{ mr: 2 }}
                >
                  Demo Merge Dialog
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={() => alert('This would simulate a conflict resolution scenario')}
                >
                  Simulate Conflicts
                </Button>
              </Box>
            </Box>
          </TabPanel>
        </Paper>

        {/* Summary */}
        <Box sx={{ mt: 4 }}>
          <Card sx={{ bgcolor: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.3)' }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: '#00e676', mb: 2 }}>
                🎉 Phase 2 Implementation Status
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip label="✅ D3 Notes Integration" color="success" />
                <Chip label="✅ File Upload System" color="success" />
                <Chip label="✅ Conflict Resolution" color="success" />
                <Chip label="🚧 Version Control UI" color="warning" />
              </Box>

              <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                Phase 2 core features are complete and functional. The enhanced ZLFN system now includes 
                interactive notes, comprehensive file management, and intelligent conflict resolution.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </ZLFNProvider>
  )
}

export default Phase2Demo
