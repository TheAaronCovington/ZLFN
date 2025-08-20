import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Box
} from '@mui/material'
import {
  Restore as RestoreIcon,
  Warning as WarningIcon
} from '@mui/icons-material'
import { useZLFN } from '../../context/ZLFNContext'

interface RestoreConfirmationProps {
  open: boolean
  onClose: () => void
  objectId: string
  versionId: string
  versionTimestamp: string
  onRestoreSuccess: () => void
}

export function RestoreConfirmation({
  open,
  onClose,
  objectId,
  versionId,
  versionTimestamp,
  onRestoreSuccess
}: RestoreConfirmationProps) {
  const { revertToVersion } = useZLFN()
  const [restoring, setRestoring] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleRestore = async () => {
    setRestoring(true)
    setError(null)
    try {
      const response = await revertToVersion(versionId)
      if (response) {
        onRestoreSuccess()
        onClose()
      } else {
        setError('Failed to restore version')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(30, 30, 30, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(64, 196, 255, 0.3)',
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <RestoreIcon sx={{ color: '#40c4ff' }} />
        <Typography variant="h6" sx={{ color: '#40c4ff' }}>
          Confirm Restore
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          <Typography variant="body2">
            Restoring to a previous version will overwrite the current state. 
            This action creates a new version and cannot be undone without restoring again.
          </Typography>
        </Alert>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: '#b0bec5', mb: 1 }}>
            Restoring to:
          </Typography>
          <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
            Version from {new Date(versionTimestamp).toLocaleString()}
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: '#b0bec5', mb: 1 }}>
            Current Object:
          </Typography>
          <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
            {objectId}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ 
        px: 3, 
        pb: 2,
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <Button onClick={onClose} variant="outlined" disabled={restoring}>
          Cancel
        </Button>
        <Button
          onClick={handleRestore}
          variant="contained"
          startIcon={<RestoreIcon />}
          disabled={restoring}
          sx={{
            bgcolor: '#40c4ff',
            '&:hover': { bgcolor: '#1976d2' }
          }}
        >
          {restoring ? 'Restoring...' : 'Confirm Restore'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RestoreConfirmation;
