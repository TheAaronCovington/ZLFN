import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Fade,
  Backdrop
} from '@mui/material'
import {
  Close as CloseIcon,
  Download as ExportIcon
} from '@mui/icons-material'

interface EnhancedDialogProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  onExport?: () => void
  children: React.ReactNode
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  fullWidth?: boolean
}

export const EnhancedDialog: React.FC<EnhancedDialogProps> = ({
  open,
  onClose,
  title,
  subtitle,
  onExport,
  children,
  maxWidth = 'lg',
  fullWidth = true
}) => {
  // Keyboard shortcuts
  React.useEffect(() => {
    if (!open) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
      if (e.key === 'e' && (e.ctrlKey || e.metaKey) && onExport) {
        e.preventDefault()
        onExport()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, onExport])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      TransitionComponent={Fade}
      TransitionProps={{ timeout: 400 }}
      BackdropComponent={Backdrop}
      BackdropProps={{
        timeout: 400,
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
        }
      }}
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, rgba(25, 25, 35, 0.95) 0%, rgba(15, 15, 25, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(64, 196, 255, 0.3)',
          borderRadius: 3,
          boxShadow: `
            0 0 30px rgba(64, 196, 255, 0.2),
            0 20px 60px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.1)
          `,
          minHeight: '80vh',
          maxHeight: '95vh',
          overflow: 'hidden'
        }
      }}
    >
      {/* Enhanced Header */}
      <DialogTitle
        sx={{
          background: 'linear-gradient(90deg, rgba(64, 196, 255, 0.1) 0%, rgba(0, 230, 118, 0.05) 100%)',
          borderBottom: '1px solid rgba(64, 196, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2,
          px: 3
        }}
      >
        <Box>
          <Typography 
            variant="h5" 
            sx={{ 
              color: '#40c4ff',
              fontWeight: 600,
              textShadow: '0 0 10px rgba(64, 196, 255, 0.3)',
              mb: subtitle ? 0.5 : 0
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.9rem'
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onExport && (
            <IconButton
              onClick={onExport}
              sx={{
                color: '#00e676',
                backgroundColor: 'rgba(0, 230, 118, 0.1)',
                border: '1px solid rgba(0, 230, 118, 0.3)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 230, 118, 0.2)',
                  boxShadow: '0 0 15px rgba(0, 230, 118, 0.3)'
                }
              }}
              title="Export (Ctrl+E)"
            >
              <ExportIcon />
            </IconButton>
          )}
          <IconButton
            onClick={onClose}
            sx={{
              color: '#40c4ff',
              backgroundColor: 'rgba(64, 196, 255, 0.1)',
              border: '1px solid rgba(64, 196, 255, 0.3)',
              '&:hover': {
                backgroundColor: 'rgba(64, 196, 255, 0.2)',
                boxShadow: '0 0 15px rgba(64, 196, 255, 0.3)'
              }
            }}
            title="Close (Esc)"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* Enhanced Content */}
      <DialogContent
        sx={{
          p: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(80vh - 80px)', // Account for header
          position: 'relative'
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

export default EnhancedDialog
