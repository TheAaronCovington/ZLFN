import React from 'react'
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Paper,
  Stack,
  Button,
  Chip,

  Alert
} from '@mui/material'
import {
  ChevronRight as ChevronRightIcon,
  Person as NodeIcon,
  Timeline as EdgeIcon,
  Analytics as AnalysisIcon,
  AccountTree as SchemeIcon,
  Speed as GraphIcon,
  Link as LinkIcon,
  Note as NoteIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenIcon
} from '@mui/icons-material'
import TruthTable from '../Visualizations/TruthTable'
import VennDiagram from '../Visualizations/VennDiagram'
import type { VennDiagramData, NecessarySufficientExample } from '../Visualizations/VennDiagram'
import type { AstNodeRec } from '../../services/logic'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
  </div>
)

interface SchemeCluster {
  id: string
  name: string
  color: string
  edges: any[]
  priority: number
  confidence: number
}

interface InspectorDrawerProps {
  open: boolean
  onClose: () => void
  topOffset?: number
  
  // Selected items
  selectedNode?: any
  selectedEdge?: any
  
  // Analysis data
  truthTableAst?: AstNodeRec | null
  onCloseTruthTable?: () => void
  vennData?: VennDiagramData
  vennExamples?: NecessarySufficientExample[]
  
  // ATN Schemes data
  schemeClusters?: SchemeCluster[]
  onSchemeClusterClick?: (cluster: SchemeCluster) => void
  
  // Graph metrics
  nodeCount?: number
  edgeCount?: number
  fps?: number
  memoryUsage?: number
  
  // Actions
  onCopyNode?: () => void
  onCopyEdge?: () => void
  onOpenNodeNotes?: () => void
  onEditNode?: () => void
  onCenterOnNode?: () => void
  onCenterOnEdge?: () => void
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  open,
  onClose,
  topOffset = 48,
  selectedNode,
  selectedEdge,
  truthTableAst,
  onCloseTruthTable,
  vennData,
  vennExamples = [],
  schemeClusters = [],
  onSchemeClusterClick,
  nodeCount = 0,
  edgeCount = 0,
  fps,
  memoryUsage,
  onCopyNode,
  onCopyEdge,
  onOpenNodeNotes,
  onEditNode,
  onCenterOnNode,
  onCenterOnEdge
}) => {
  const [activeTab, setActiveTab] = React.useState(0)

  // Auto-switch to appropriate tab based on selection
  React.useEffect(() => {
    if (selectedNode && activeTab !== 0) {
      setActiveTab(0) // Node tab
    } else if (selectedEdge && activeTab !== 1) {
      setActiveTab(1) // Edge tab
    }
  }, [selectedNode, selectedEdge, activeTab])

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  return (
    <Drawer
      variant="persistent"
      anchor="right"
      open={open}
      sx={{
        width: { xs: 300, sm: 350, md: 400 },
        flexShrink: 0,
        display: open ? 'block' : 'none',
        '& .MuiDrawer-paper': {
          width: { xs: 300, sm: 350, md: 400 },
          backgroundColor: 'rgba(25, 25, 35, 0.95)',
          backdropFilter: 'blur(8px)',
          borderLeft: '1px solid rgba(64, 196, 255, 0.2)',
          top: topOffset, // Below command bar(s)
          height: `calc(100vh - ${topOffset}px - 32px)`, // Account for command bar(s) and status bar
        }
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, pb: 0 }}>
          <Typography variant="h6" sx={{ color: '#40c4ff', fontWeight: 600 }}>
            Inspector
          </Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: '#40c4ff' }}>
            <ChevronRightIcon />
          </IconButton>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'rgba(64, 196, 255, 0.2)' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': { 
                color: 'rgba(255, 255, 255, 0.7)',
                minWidth: 80,
                '&.Mui-selected': { color: '#40c4ff' }
              },
              '& .MuiTabs-indicator': { backgroundColor: '#40c4ff' }
            }}
          >
            <Tab 
              icon={<NodeIcon />} 
              label="Node" 
              sx={{ minHeight: 48 }}
            />
            <Tab 
              icon={<EdgeIcon />} 
              label="Edge" 
              sx={{ minHeight: 48 }}
            />
            <Tab 
              icon={<AnalysisIcon />} 
              label="Analysis" 
              sx={{ minHeight: 48 }}
            />
            <Tab 
              icon={<SchemeIcon />} 
              label="Schemes" 
              sx={{ minHeight: 48 }}
            />
            <Tab 
              icon={<GraphIcon />} 
              label="Graph" 
              sx={{ minHeight: 48 }}
            />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          {/* Node Tab */}
          <TabPanel value={activeTab} index={0}>
            {selectedNode ? (
              <Stack spacing={2}>
                <Paper sx={{ p: 2, backgroundColor: 'rgba(64, 196, 255, 0.05)' }}>
                  <Typography variant="h6" sx={{ color: '#40c4ff', mb: 1 }}>
                    {selectedNode.label || selectedNode.id}
                  </Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        ID
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ffffff', fontFamily: 'monospace' }}>
                        {selectedNode.id}
                      </Typography>
                    </Box>
                    {selectedNode.type && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          Type
                        </Typography>
                        <Chip 
                          label={selectedNode.type} 
                          size="small" 
                          sx={{ ml: 1, textTransform: 'capitalize' }}
                        />
                      </Box>
                    )}
                    {selectedNode.expression && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          Expression
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff', fontFamily: 'monospace' }}>
                          {selectedNode.expression}
                        </Typography>
                      </Box>
                    )}
                    {selectedNode.markdownRef && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          Markdown Reference
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinkIcon sx={{ fontSize: 16, color: '#40c4ff' }} />
                          <Typography variant="body2" sx={{ color: '#40c4ff' }}>
                            {selectedNode.markdownRef}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Stack>
                </Paper>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {onCopyNode && (
                    <Button size="small" startIcon={<CopyIcon />} onClick={onCopyNode}>
                      Copy
                    </Button>
                  )}
                  {onOpenNodeNotes && (
                    <Button size="small" startIcon={<NoteIcon />} onClick={onOpenNodeNotes}>
                      Notes
                    </Button>
                  )}
                  {onEditNode && (
                    <Button size="small" startIcon={<OpenIcon />} onClick={onEditNode}>
                      Edit
                    </Button>
                  )}
                  {onCenterOnNode && (
                    <Button size="small" onClick={onCenterOnNode}>
                      Center
                    </Button>
                  )}
                </Stack>
              </Stack>
            ) : (
              <Alert severity="info" sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
                Select a node to view its properties
              </Alert>
            )}
          </TabPanel>

          {/* Edge Tab */}
          <TabPanel value={activeTab} index={1}>
            {selectedEdge ? (
              <Stack spacing={2}>
                <Paper sx={{ p: 2, backgroundColor: 'rgba(64, 196, 255, 0.05)' }}>
                  <Typography variant="h6" sx={{ color: '#40c4ff', mb: 1 }}>
                    Edge Details
                  </Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Rule
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ffffff' }}>
                        {selectedEdge.rule || selectedEdge.label || '(none)'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        From
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ffffff', fontFamily: 'monospace' }}>
                        {(selectedEdge.from ?? selectedEdge.source) as string}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        To
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ffffff', fontFamily: 'monospace' }}>
                        {(selectedEdge.to ?? selectedEdge.target) as string}
                      </Typography>
                    </Box>
                    {selectedEdge.type && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          Type
                        </Typography>
                        <Chip 
                          label={selectedEdge.type} 
                          size="small" 
                          sx={{ ml: 1 }}
                        />
                      </Box>
                    )}
                    {typeof selectedEdge.weight === 'number' && (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          Weight
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ffffff' }}>
                          {selectedEdge.weight}%
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Paper>

                <Stack direction="row" spacing={1}>
                  {onCopyEdge && (
                    <Button size="small" startIcon={<CopyIcon />} onClick={onCopyEdge}>
                      Copy
                    </Button>
                  )}
                  {onCenterOnEdge && (
                    <Button size="small" onClick={onCenterOnEdge}>
                      Center
                    </Button>
                  )}
                </Stack>
              </Stack>
            ) : (
              <Alert severity="info" sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
                Select an edge to view its properties
              </Alert>
            )}
          </TabPanel>

          {/* Analysis Tab */}
          <TabPanel value={activeTab} index={2}>
            <Stack spacing={3}>
              {/* Truth Table */}
              {truthTableAst && (
                <Paper sx={{ p: 2, backgroundColor: 'rgba(64, 196, 255, 0.05)' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ color: '#40c4ff' }}>
                      Truth Table
                    </Typography>
                    {onCloseTruthTable && (
                      <Button size="small" onClick={onCloseTruthTable}>
                        Close
                      </Button>
                    )}
                  </Box>
                  <TruthTable ast={truthTableAst} />
                </Paper>
              )}

              {/* Venn Diagram */}
              {vennData && (
                <Paper sx={{ p: 2, backgroundColor: 'rgba(64, 196, 255, 0.05)' }}>
                  <Typography variant="h6" sx={{ color: '#40c4ff', mb: 2 }}>
                    Necessary & Sufficient
                  </Typography>
                  <VennDiagram 
                    title="" 
                    data={vennData} 
                    type="necessary-sufficient" 
                    examples={vennExamples} 
                  />
                </Paper>
              )}

              {!truthTableAst && !vennData && (
                <Alert severity="info" sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
                  Analysis tools will appear here when available
                </Alert>
              )}
            </Stack>
          </TabPanel>

          {/* Schemes Tab */}
          <TabPanel value={activeTab} index={3}>
            <Stack spacing={2}>
              {schemeClusters.length > 0 ? (
                <>
                  <Paper sx={{ p: 2, backgroundColor: 'rgba(64, 196, 255, 0.05)' }}>
                    <Typography variant="h6" sx={{ color: '#40c4ff', mb: 2 }}>
                      Argumentation Schemes
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
                      {schemeClusters.length} scheme{schemeClusters.length !== 1 ? 's' : ''} detected
                    </Typography>
                  </Paper>
                  
                  {schemeClusters.map((cluster) => (
                    <Paper 
                      key={cluster.id}
                      sx={{ 
                        p: 2, 
                        backgroundColor: 'rgba(25, 25, 35, 0.8)',
                        border: '1px solid rgba(64, 196, 255, 0.2)',
                        cursor: onSchemeClusterClick ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        '&:hover': onSchemeClusterClick ? {
                          backgroundColor: 'rgba(64, 196, 255, 0.1)',
                          borderColor: 'rgba(64, 196, 255, 0.4)'
                        } : {}
                      }}
                      onClick={() => onSchemeClusterClick?.(cluster)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: cluster.color,
                            mr: 1.5,
                            flexShrink: 0
                          }}
                        />
                        <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 600 }}>
                          {cluster.name}
                        </Typography>
                      </Box>
                      
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            Edges
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#ffffff' }}>
                            {cluster.edges.length}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            Priority
                          </Typography>
                          <Chip
                            label={`${cluster.priority}%`}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor: cluster.priority > 80 ? 'rgba(76, 175, 80, 0.2)' : 
                                             cluster.priority > 60 ? 'rgba(255, 152, 0, 0.2)' : 
                                             'rgba(244, 67, 54, 0.2)',
                              color: cluster.priority > 80 ? '#4caf50' : 
                                     cluster.priority > 60 ? '#ff9800' : 
                                     '#f44336'
                            }}
                          />
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            Confidence
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#ffffff' }}>
                            {Math.round(cluster.confidence * 100)}%
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                </>
              ) : (
                <Alert severity="info" sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
                  No argumentation schemes detected in current argument
                </Alert>
              )}
            </Stack>
          </TabPanel>

          {/* Graph Tab */}
          <TabPanel value={activeTab} index={4}>
            <Stack spacing={2}>
              <Paper sx={{ p: 2, backgroundColor: 'rgba(64, 196, 255, 0.05)' }}>
                <Typography variant="h6" sx={{ color: '#40c4ff', mb: 2 }}>
                  Graph Summary
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      Nodes
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                      {nodeCount}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      Edges
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                      {edgeCount}
                    </Typography>
                  </Box>
                  {fps !== undefined && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        FPS
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: fps > 30 ? '#4caf50' : fps > 15 ? '#ff9800' : '#f44336',
                          fontWeight: 500 
                        }}
                      >
                        {Math.round(fps)}
                      </Typography>
                    </Box>
                  )}
                  {memoryUsage !== undefined && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Memory
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                        {Math.round(memoryUsage)} MB
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </TabPanel>
        </Box>
      </Box>
    </Drawer>
  )
}

export default InspectorDrawer
