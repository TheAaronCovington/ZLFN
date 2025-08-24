import React from 'react'
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Button,
  Stack,
  FormGroup,
  FormControlLabel,
  Checkbox,

  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemButton
} from '@mui/material'
import {
  ChevronLeft as ChevronLeftIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Settings as SettingsIcon,
  Description as DocumentIcon,
  History as HistoryIcon
} from '@mui/icons-material'

interface ControlsDrawerProps {
  open: boolean
  onClose: () => void
  topOffset?: number
  
  // Expression
  expression: string
  onExpressionChange: (value: string) => void
  onResetExpression: () => void
  onCopyExpression: () => void
  onConvertToNNF: () => void
  onConvertToCNF: () => void
  
  // Modes
  modes: Record<string, boolean>
  onModeChange: (mode: string, checked: boolean) => void
  
  // Document Mode
  useDocumentData: boolean
  onToggleDocumentData: () => void
  documentArguments?: Array<{
    id: string
    title: string
    type: string
    premises: string[]
    conclusions: string[]
    validity?: string
  }>
  
  // Demo Extras
  // Removed demo extras for clean testing
  
  // Recent expressions (if available)
  recentExpressions?: string[]
  onSelectRecentExpression?: (expr: string) => void
}

export const ControlsDrawer: React.FC<ControlsDrawerProps> = ({
  open,
  onClose,
  topOffset = 48,
  expression,
  onExpressionChange,
  onResetExpression,
  onCopyExpression,
  onConvertToNNF,
  onConvertToCNF,
  modes,
  onModeChange,
  useDocumentData,
  onToggleDocumentData,
  documentArguments = [],
  recentExpressions = [],
  onSelectRecentExpression
}) => {
  const modeList = ['classical', 'epistemic', 'deontic', 'temporal', 'informal', 'paraconsistent', 'fuzzy'] as const

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: { xs: 280, sm: 320, md: 360 },
        flexShrink: 0,
        display: open ? 'block' : 'none',
        '& .MuiDrawer-paper': {
          width: { xs: 280, sm: 320, md: 360 },
          backgroundColor: 'rgba(25, 25, 35, 0.95)',
          backdropFilter: 'blur(8px)',
          borderRight: '1px solid rgba(64, 196, 255, 0.2)',
          top: topOffset, // Below command bar(s)
          height: `calc(100vh - ${topOffset}px - 32px)`, // Account for command bar(s) and status bar
        }
      }}
    >
      <Box sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ color: '#40c4ff', fontWeight: 600 }}>
            Controls
          </Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: '#40c4ff' }}>
            <ChevronLeftIcon />
          </IconButton>
        </Box>

        {/* Expression Section */}
        <Accordion defaultExpanded sx={{ mb: 1, backgroundColor: 'rgba(64, 196, 255, 0.05)' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#40c4ff' }} />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CodeIcon sx={{ color: '#40c4ff', fontSize: 20 }} />
              <Typography sx={{ color: '#40c4ff', fontWeight: 500 }}>Expression</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={expression}
                onChange={(e) => onExpressionChange(e.target.value)}
                placeholder="Enter logical expression..."
                variant="outlined"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    '& fieldset': { borderColor: 'rgba(64, 196, 255, 0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(64, 196, 255, 0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#40c4ff' }
                  }
                }}
              />
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button size="small" variant="outlined" onClick={onResetExpression}>
                  Reset
                </Button>
                <Button size="small" variant="outlined" onClick={onCopyExpression}>
                  Copy
                </Button>
                <Button size="small" variant="outlined" onClick={onConvertToNNF}>
                  NNF
                </Button>
                <Button size="small" variant="outlined" onClick={onConvertToCNF}>
                  CNF
                </Button>
              </Stack>
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Logic Modes Section */}
        <Accordion sx={{ mb: 1, backgroundColor: 'rgba(64, 196, 255, 0.05)' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#40c4ff' }} />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon sx={{ color: '#40c4ff', fontSize: 20 }} />
              <Typography sx={{ color: '#40c4ff', fontWeight: 500 }}>Logic Modes</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <FormGroup>
              {modeList.map((mode) => (
                <FormControlLabel
                  key={mode}
                  control={
                    <Checkbox
                      checked={!!modes[mode]}
                      onChange={(_, checked) => onModeChange(mode, checked)}
                      sx={{ color: '#40c4ff', '&.Mui-checked': { color: '#40c4ff' } }}
                    />
                  }
                  label={mode}
                  sx={{ color: '#ffffff', textTransform: 'capitalize' }}
                />
              ))}
            </FormGroup>
          </AccordionDetails>
        </Accordion>

        {/* Document Mode Section */}
        <Accordion sx={{ mb: 1, backgroundColor: 'rgba(64, 196, 255, 0.05)' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#40c4ff' }} />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DocumentIcon sx={{ color: '#40c4ff', fontSize: 20 }} />
              <Typography sx={{ color: '#40c4ff', fontWeight: 500 }}>Document Mode</Typography>
              {useDocumentData && (
                <Chip label="Active" size="small" color="success" sx={{ ml: 1 }} />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={useDocumentData}
                    onChange={() => onToggleDocumentData()}
                    sx={{ color: '#40c4ff', '&.Mui-checked': { color: '#40c4ff' } }}
                  />
                }
                label="Use Document Data"
                sx={{ color: '#ffffff' }}
              />
              
              {useDocumentData && documentArguments.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#40c4ff', mb: 1 }}>
                    Arguments ({documentArguments.length})
                  </Typography>
                  <List dense>
                    {documentArguments.slice(0, 3).map((arg) => (
                      <ListItem key={arg.id} sx={{ px: 0 }}>
                        <ListItemText
                          primary={arg.title}
                          secondary={`${arg.type} • ${arg.premises.length} premises`}
                          primaryTypographyProps={{ 
                            sx: { color: '#ffffff', fontSize: '0.875rem' } 
                          }}
                          secondaryTypographyProps={{ 
                            sx: { color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem' } 
                          }}
                        />
                      </ListItem>
                    ))}
                    {documentArguments.length > 3 && (
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText
                          primary={`+${documentArguments.length - 3} more arguments`}
                          primaryTypographyProps={{ 
                            sx: { color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem', fontStyle: 'italic' } 
                          }}
                        />
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Demo & Settings Section */}
        <Accordion sx={{ mb: 1, backgroundColor: 'rgba(64, 196, 255, 0.05)' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#40c4ff' }} />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon sx={{ color: '#40c4ff', fontSize: 20 }} />
              <Typography sx={{ color: '#40c4ff', fontWeight: 500 }}>Settings</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <FormGroup>
              {/* Demo Extras removed for clean testing */}
            </FormGroup>
          </AccordionDetails>
        </Accordion>

        {/* Recent Expressions */}
        {recentExpressions.length > 0 && onSelectRecentExpression && (
          <Accordion sx={{ mb: 1, backgroundColor: 'rgba(64, 196, 255, 0.05)' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#40c4ff' }} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon sx={{ color: '#40c4ff', fontSize: 20 }} />
                <Typography sx={{ color: '#40c4ff', fontWeight: 500 }}>Recent</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {recentExpressions.slice(0, 5).map((expr, index) => (
                  <ListItemButton
                    key={index}
                    onClick={() => onSelectRecentExpression(expr)}
                    sx={{ 
                      px: 1, 
                      borderRadius: 1,
                      '&:hover': { backgroundColor: 'rgba(64, 196, 255, 0.1)' }
                    }}
                  >
                    <ListItemText
                      primary={expr.length > 30 ? expr.substring(0, 30) + '...' : expr}
                      primaryTypographyProps={{ 
                        sx: { color: '#ffffff', fontSize: '0.875rem', fontFamily: 'monospace' } 
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    </Drawer>
  )
}

export default ControlsDrawer
