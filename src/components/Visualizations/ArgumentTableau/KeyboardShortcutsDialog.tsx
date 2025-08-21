/**
 * ATN Keyboard Shortcuts Help Dialog
 * Displays all available keyboard shortcuts organized by category
 */

import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Divider
} from '@mui/material'
import {
  Close as CloseIcon,
  Keyboard as KeyboardIcon
} from '@mui/icons-material'
import { 
  groupShortcutsByCategory, 
  formatShortcut
} from './keyboardShortcuts'

export interface KeyboardShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

const CATEGORY_ICONS = {
  Layout: '🏗️',
  Analysis: '📊', 
  Export: '📤',
  Navigation: '🧭',
  View: '👁️',
  Facets: '💎',
  Settings: '⚙️'
}

const CATEGORY_COLORS = {
  Layout: '#4CAF50',
  Analysis: '#2196F3', 
  Export: '#FF9800',
  Navigation: '#9C27B0',
  View: '#00BCD4',
  Facets: '#E91E63',
  Settings: '#607D8B'
}

const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({
  open,
  onClose
}) => {
  const shortcutGroups = groupShortcutsByCategory()
  const categoryOrder = ['Layout', 'Analysis', 'Navigation', 'View', 'Facets', 'Export', 'Settings']

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'var(--ai-bg-primary)',
          color: 'var(--ai-text-primary)',
          minHeight: '70vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: 'var(--ai-bg-secondary)',
        color: 'var(--ai-text-primary)',
        borderBottom: '1px solid rgba(64,196,255,0.3)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <KeyboardIcon sx={{ color: '#40c4ff' }} />
          <Typography variant="h6">
            ATN Keyboard Shortcuts
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'var(--ai-text-secondary)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ 
          color: 'var(--ai-text-secondary)', 
          mb: 3,
          textAlign: 'center'
        }}>
          Use these keyboard shortcuts to efficiently navigate and control the Argument Tableau Network
        </Typography>

        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 3
        }}>
          {categoryOrder.map(category => {
            const shortcuts = shortcutGroups[category] || []
            if (shortcuts.length === 0) return null

            return (
              <Card key={category} sx={{ 
                backgroundColor: 'var(--ai-bg-secondary)',
                border: `1px solid ${CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]}40`,
                height: 'fit-content'
              }}>
                <CardContent>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1, 
                    mb: 2 
                  }}>
                    <Typography variant="h6" sx={{ fontSize: '1.2rem' }}>
                      {CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS]}
                    </Typography>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        color: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS],
                        fontWeight: 600
                      }}
                    >
                      {category}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {shortcuts.map(({ action, config }) => (
                      <Box 
                        key={action}
                        sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          p: 1,
                          borderRadius: 1,
                          backgroundColor: 'rgba(64,196,255,0.05)',
                          '&:hover': {
                            backgroundColor: 'rgba(64,196,255,0.1)'
                          }
                        }}
                      >
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: 'var(--ai-text-primary)',
                            fontSize: '0.875rem',
                            flex: 1
                          }}
                        >
                          {config.description}
                        </Typography>
                        
                        <Chip
                          label={formatShortcut(config)}
                          size="small"
                          sx={{
                            backgroundColor: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS],
                            color: 'white',
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            minWidth: 'auto'
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            )
          })}
        </Box>

        <Divider sx={{ my: 3, borderColor: 'rgba(64,196,255,0.3)' }} />

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'var(--ai-text-secondary)', mb: 1 }}>
            💡 <strong>Pro Tips:</strong>
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--ai-text-secondary)' }}>
            • Shortcuts are disabled when typing in input fields or dialogs<br/>
            • Use <Chip label="Tab" size="small" sx={{ mx: 0.5, fontSize: '0.7rem' }} /> to quickly cycle through layouts<br/>
            • Hold <Chip label="Ctrl" size="small" sx={{ mx: 0.5, fontSize: '0.7rem' }} /> for export shortcuts<br/>
            • Press <Chip label="Shift + ?" size="small" sx={{ mx: 0.5, fontSize: '0.7rem' }} /> anytime to show this help
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ 
        p: 2, 
        backgroundColor: 'var(--ai-bg-secondary)',
        borderTop: '1px solid rgba(64,196,255,0.3)'
      }}>
        <Button 
          onClick={onClose}
          variant="contained"
          sx={{ 
            backgroundColor: '#40c4ff',
            color: 'white',
            '&:hover': { backgroundColor: '#2196F3' }
          }}
        >
          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default KeyboardShortcutsDialog
