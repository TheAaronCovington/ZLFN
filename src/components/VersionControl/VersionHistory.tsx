
import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Collapse,
  IconButton,
  Divider,
  Alert
} from '@mui/material'
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab'
import {
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Restore as RestoreIcon,
  Difference as DiffIcon
} from '@mui/icons-material'
import { useZLFN } from '../../context/ZLFNContext'
import type { ZLFNVersion } from '../../types/zlfn'
import { RestoreConfirmation } from './RestoreConfirmation'

interface VersionHistoryProps {
  objectId: string
  onViewDiff: (versionId: string) => void
  maxVersions?: number
}

export function VersionHistory({
  objectId,
  onViewDiff,
  maxVersions = 20
}: VersionHistoryProps) {
  const { getVersionHistory } = useZLFN()
  const [versions, setVersions] = useState<ZLFNVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [selectedRestoreVersion, setSelectedRestoreVersion] = useState<{ id: string; timestamp: string } | null>(null)

  const loadVersions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const versionData = await getVersionHistory()
      if (versionData) {
        setVersions(versionData.slice(0, maxVersions))
      } else {
        setError('Failed to load version history')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [getVersionHistory, maxVersions])

  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  const handleToggleExpand = (versionId: string) => {
    setExpandedVersion(prev => prev === versionId ? null : versionId)
  }

  const handleOpenRestore = (versionId: string, timestamp: string) => {
    setSelectedRestoreVersion({ id: versionId, timestamp })
    setRestoreDialogOpen(true)
  }

  if (loading) {
    return (
      <Alert severity="info" icon={<HistoryIcon />}>
        Loading version history...
      </Alert>
    )
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    )
  }

  if (versions.length === 0) {
    return (
      <Alert severity="info" icon={<HistoryIcon />}>
        No version history available yet. Make some changes to create versions.
      </Alert>
    )
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h6" sx={{ color: '#40c4ff', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon />
        Version History ({versions.length})
      </Typography>

      <Timeline position="alternate">
        {versions.map((version, index) => {
          const versionKey = String(index);
          const isExpanded = expandedVersion === versionKey
          const isLatest = index === 0
          const changesCount = (version as any)?.changes?.length || 0

          return (
            <TimelineItem key={index}>
              <TimelineSeparator>
                <TimelineDot color={isLatest ? 'primary' : 'grey'}>
                  <HistoryIcon sx={{ fontSize: 16 }} />
                </TimelineDot>
                {index < versions.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent>
                <Card 
                  sx={{ 
                    bgcolor: isLatest ? 'rgba(64, 196, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(64, 196, 255, 0.3)',
                    mb: 2
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ color: '#40c4ff' }}>
                          Version {versions.length - index}
                        </Typography>
                        {isLatest && <Chip label="Latest" size="small" color="success" />}
                      </Box>
                      <IconButton size="small" onClick={() => handleToggleExpand(versionKey)}>
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>

                    <Typography variant="body2" sx={{ color: '#b0bec5', mb: 1 }}>
                      {new Date((version as any)?.timestamp || '').toLocaleString()}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <Chip 
                        label={`${changesCount} changes`} 
                        size="small" 
                        color="info" 
                        icon={<DiffIcon sx={{ fontSize: 12 }} />}
                      />
                      <Chip 
                        label={(version as any)?.author || 'Anonymous'} 
                        size="small" 
                        color="secondary"
                      />
                    </Box>

                    <Collapse in={isExpanded}>
                      <Divider sx={{ my: 1 }} />
                      
                      <Typography variant="subtitle2" sx={{ mb: 1, color: '#40c4ff' }}>
                        Changes:
                      </Typography>
                      {((version as any)?.changes || []).map((change: any, changeIndex: number) => (
                            <Typography key={changeIndex} variant="body2" sx={{ color: '#e0e0e0' }}>
                              {change.description} — Type: {String(change.type || '')}
                            </Typography>
                          ))}
                      {((version as any)?.changes || []).length === 0 && (
                        <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                          No detailed changes recorded
                        </Typography>
                      )}

                      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          startIcon={<RestoreIcon />}
                          onClick={() => handleOpenRestore(versionKey, String((version as any)?.timestamp || ''))}
                          variant="outlined"
                          color="success"
                          disabled={isLatest}
                        >
                          Restore
                        </Button>
                        <Button
                          size="small"
                          startIcon={<DiffIcon />}
                          onClick={() => onViewDiff((version as any)?.id || '')}
                          variant="outlined"
                          color="info"
                        >
                          View Diff
                        </Button>
                      </Box>
                    </Collapse>
                  </CardContent>
                </Card>
              </TimelineContent>
            </TimelineItem>
          )
        })}
      </Timeline>
      <RestoreConfirmation
        open={restoreDialogOpen}
        onClose={() => {
          setRestoreDialogOpen(false)
          setSelectedRestoreVersion(null)
        }}
        objectId={objectId}
        versionId={selectedRestoreVersion?.id || ''}
        versionTimestamp={selectedRestoreVersion?.timestamp || ''}
        onRestoreSuccess={() => {
          // Refresh versions after successful restore
          loadVersions()
        }}
      />
    </Box>
  )
}

export default VersionHistory;
