/**
 * Notes Tooltip Component
 * Displays note preview on hover with quick actions
 */


import {
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip
} from '@mui/material'
import {
  Edit as EditIcon,
  Note as NoteIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material'

interface NotesTooltipProps {
  nodeId: string
  nodeName: string
  noteContent: string
  hasNote: boolean
  onEdit: () => void
  lastModified?: string
}

export function NotesTooltip({ 
  nodeId, 
  nodeName, 
  noteContent, 
  hasNote, 
  onEdit,
  lastModified 
}: NotesTooltipProps) {
  
  const truncatedNote = noteContent.length > 150 
    ? noteContent.substring(0, 150) + '...' 
    : noteContent

  const wordCount = noteContent.trim().split(/\s+/).filter(word => word.length > 0).length

  return (
    <Box
      sx={{
        maxWidth: 300,
        p: 2,
        bgcolor: 'rgba(30, 30, 30, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(64, 196, 255, 0.3)',
        borderRadius: 2,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NoteIcon sx={{ color: hasNote ? '#ffc107' : '#666', fontSize: 18 }} />
          <Typography variant="subtitle2" sx={{ color: '#40c4ff', fontWeight: 600 }}>
            {nodeName || nodeId}
          </Typography>
        </Box>
        
        <Tooltip title="Edit Note">
          <IconButton 
            size="small" 
            onClick={onEdit}
            sx={{ 
              color: '#40c4ff',
              '&:hover': { bgcolor: 'rgba(64, 196, 255, 0.1)' }
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Node ID */}
      <Chip 
        label={nodeId} 
        size="small" 
        sx={{ 
          mb: 1,
          bgcolor: 'rgba(64, 196, 255, 0.2)', 
          color: '#40c4ff',
          fontFamily: 'monospace',
          fontSize: '0.7rem'
        }} 
      />

      {/* Note Content */}
      {hasNote ? (
        <Box>
          <Typography 
            variant="body2" 
            sx={{ 
              color: '#e0e0e0', 
              mb: 1,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap'
            }}
          >
            {truncatedNote}
          </Typography>
          
          {/* Note Stats */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            pt: 1,
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip 
                label={`${wordCount} words`}
                size="small"
                sx={{ 
                  bgcolor: 'rgba(0, 230, 118, 0.2)', 
                  color: '#00e676',
                  fontSize: '0.6rem',
                  height: 18
                }}
              />
              {noteContent.length > 150 && (
                <Chip 
                  label="Truncated"
                  size="small"
                  sx={{ 
                    bgcolor: 'rgba(255, 193, 7, 0.2)', 
                    color: '#ffc107',
                    fontSize: '0.6rem',
                    height: 18
                  }}
                />
              )}
            </Box>
            
            {lastModified && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ScheduleIcon sx={{ fontSize: 12, color: '#b0bec5' }} />
                <Typography variant="caption" sx={{ color: '#b0bec5', fontSize: '0.6rem' }}>
                  {new Date(lastModified).toLocaleDateString()}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="body2" sx={{ color: '#b0bec5', fontStyle: 'italic', mb: 1 }}>
            No note yet
          </Typography>
          <Typography variant="caption" sx={{ color: '#666' }}>
            Click to add a note
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default NotesTooltip
