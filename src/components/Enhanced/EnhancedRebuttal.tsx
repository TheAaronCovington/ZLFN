/**
 * Enhanced Rebuttal Analysis Component
 * Provides detailed analysis of rebuttals and counterarguments
 */

import React, { useState, useMemo } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Rating,
  LinearProgress,
  Tabs,
  Tab,
  Alert,
  IconButton
} from '@mui/material'
import {
  Gavel as GavelIcon,
  Shield as ShieldIcon,
  MyLocation as TargetIcon,
  Edit as EditIcon
} from '@mui/icons-material'

export interface RebuttalData {
  nodeId: string
  nodeName: string
  argumentType?: string
  
  // Core rebuttal information
  rebuttalType: 'direct' | 'indirect' | 'undercut' | 'defeater'
  targetClaim: string
  rebuttalClaim: string
  strength: number // 0-100
  
  // Analysis components
  evidence: RebuttalEvidence[]
  weaknesses: RebuttalWeakness[]
  counterRebuttals: CounterRebuttal[]
  
  // Metadata
  confidence: number // 0-100, analyst confidence
  sources?: string[]
  tags?: string[]
}

export interface RebuttalEvidence {
  id: string
  type: 'empirical' | 'logical' | 'precedent' | 'authority'
  description: string
  strength: number
  source?: string
}

export interface RebuttalWeakness {
  id: string
  type: 'logical' | 'evidential' | 'scope' | 'relevance'
  description: string
  severity: number // 0-100
  mitigation?: string
}

export interface CounterRebuttal {
  id: string
  claim: string
  strength: number
  response?: string
}

export interface EnhancedRebuttalProps {
  data: RebuttalData
  onDataChange?: (data: RebuttalData) => void
  readonly?: boolean
}

const REBUTTAL_TYPE_COLORS = {
  direct: '#F44336',      // Red - direct attack
  indirect: '#FF9800',    // Orange - indirect challenge
  undercut: '#9C27B0',    // Purple - undermining premises
  defeater: '#D32F2F'     // Dark red - strong defeater
}

const EVIDENCE_TYPE_ICONS = {
  empirical: '🔬',
  logical: '🧠',
  precedent: '📚',
  authority: '👨‍⚖️'
}

const EnhancedRebuttal: React.FC<EnhancedRebuttalProps> = ({
  data,
  onDataChange: _onDataChange,
  readonly = false
}) => {
  const [activeTab, setActiveTab] = useState(0)
  const [editMode, setEditMode] = useState(false)

  // Calculate overall assessment
  const overallAssessment = useMemo(() => {
    const evidenceScore = data.evidence.reduce((sum, e) => sum + e.strength, 0) / Math.max(data.evidence.length, 1)
    const weaknessScore = 100 - (data.weaknesses.reduce((sum, w) => sum + w.severity, 0) / Math.max(data.weaknesses.length, 1))
    const counterScore = 100 - (data.counterRebuttals.reduce((sum, c) => sum + c.strength, 0) / Math.max(data.counterRebuttals.length, 1))
    
    return Math.round((evidenceScore + weaknessScore + counterScore) / 3)
  }, [data])



  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 800 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <GavelIcon sx={{ color: REBUTTAL_TYPE_COLORS[data.rebuttalType] }} />
          <Typography variant="h5" sx={{ color: 'var(--ai-text-primary)' }}>
            Rebuttal Analysis: {data.nodeName}
          </Typography>
          {!readonly && (
            <IconButton onClick={() => setEditMode(!editMode)} size="small">
              <EditIcon />
            </IconButton>
          )}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Chip
            label={data.rebuttalType.toUpperCase()}
            sx={{
              backgroundColor: REBUTTAL_TYPE_COLORS[data.rebuttalType],
              color: 'white',
              fontWeight: 600
            }}
          />
          <Chip
            label={`Strength: ${data.strength}%`}
            color={data.strength >= 70 ? 'success' : data.strength >= 40 ? 'warning' : 'error'}
          />
          <Chip
            label={`Confidence: ${data.confidence}%`}
            variant="outlined"
          />
        </Stack>

        {/* Overall Assessment */}
        <Card sx={{ backgroundColor: 'var(--ai-bg-secondary)', mb: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1, color: 'var(--ai-text-primary)' }}>
              Overall Assessment
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ minWidth: 120, color: 'var(--ai-text-secondary)' }}>
                Effectiveness:
              </Typography>
              <LinearProgress
                variant="determinate"
                value={overallAssessment}
                sx={{ flex: 1, mx: 2, height: 8, borderRadius: 4 }}
                color={overallAssessment >= 70 ? 'success' : overallAssessment >= 40 ? 'warning' : 'error'}
              />
              <Typography variant="body2" sx={{ color: 'var(--ai-text-primary)' }}>
                {overallAssessment}%
              </Typography>
            </Box>
            <Rating
              value={overallAssessment / 20}
              precision={0.1}
              readOnly
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="Overview" />
        <Tab label="Evidence" />
        <Tab label="Analysis" />
        <Tab label="Counter-Rebuttals" />
      </Tabs>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box>
          {/* Target and Rebuttal Claims */}
          <Card sx={{ mb: 2, backgroundColor: 'var(--ai-bg-secondary)' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: 'var(--ai-text-primary)' }}>
                Claims Analysis
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <TargetIcon sx={{ color: '#1976D2' }} />
                  <Typography variant="subtitle1" sx={{ color: 'var(--ai-text-primary)' }}>
                    Target Claim
                  </Typography>
                </Stack>
                <Typography variant="body1" sx={{ 
                  p: 2, 
                  backgroundColor: 'rgba(25, 118, 210, 0.1)', 
                  borderRadius: 1,
                  color: 'var(--ai-text-primary)'
                }}>
                  {data.targetClaim}
                </Typography>
              </Box>

              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <ShieldIcon sx={{ color: REBUTTAL_TYPE_COLORS[data.rebuttalType] }} />
                  <Typography variant="subtitle1" sx={{ color: 'var(--ai-text-primary)' }}>
                    Rebuttal Claim
                  </Typography>
                </Stack>
                <Typography variant="body1" sx={{ 
                  p: 2, 
                  backgroundColor: `rgba(244, 67, 54, 0.1)`, 
                  borderRadius: 1,
                  color: 'var(--ai-text-primary)'
                }}>
                  {data.rebuttalClaim}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Stack direction="row" spacing={2}>
            <Card sx={{ flex: 1, backgroundColor: 'var(--ai-bg-secondary)' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: '#4CAF50', mb: 1 }}>
                  {data.evidence.length}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--ai-text-secondary)' }}>
                  Evidence Points
                </Typography>
              </CardContent>
            </Card>
            
            <Card sx={{ flex: 1, backgroundColor: 'var(--ai-bg-secondary)' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: '#FF9800', mb: 1 }}>
                  {data.weaknesses.length}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--ai-text-secondary)' }}>
                  Weaknesses
                </Typography>
              </CardContent>
            </Card>
            
            <Card sx={{ flex: 1, backgroundColor: 'var(--ai-bg-secondary)' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: '#F44336', mb: 1 }}>
                  {data.counterRebuttals.length}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--ai-text-secondary)' }}>
                  Counter-Rebuttals
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, color: 'var(--ai-text-primary)' }}>
            Supporting Evidence
          </Typography>
          
          {data.evidence.length === 0 ? (
            <Alert severity="info">No evidence points recorded for this rebuttal.</Alert>
          ) : (
            <Stack spacing={2}>
              {data.evidence.map((evidence) => (
                <Card key={evidence.id} sx={{ backgroundColor: 'var(--ai-bg-secondary)' }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                      <Typography variant="h6" sx={{ fontSize: '1.2rem' }}>
                        {EVIDENCE_TYPE_ICONS[evidence.type]}
                      </Typography>
                      <Chip
                        label={evidence.type}
                        size="small"
                        variant="outlined"
                      />
                      <Box sx={{ flex: 1 }} />
                      <Chip
                        label={`${evidence.strength}%`}
                        color={evidence.strength >= 70 ? 'success' : evidence.strength >= 40 ? 'warning' : 'error'}
                        size="small"
                      />
                    </Stack>
                    <Typography variant="body1" sx={{ color: 'var(--ai-text-primary)', mb: 1 }}>
                      {evidence.description}
                    </Typography>
                    {evidence.source && (
                      <Typography variant="caption" sx={{ color: 'var(--ai-text-secondary)' }}>
                        Source: {evidence.source}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, color: 'var(--ai-text-primary)' }}>
            Weakness Analysis
          </Typography>
          
          {data.weaknesses.length === 0 ? (
            <Alert severity="success">No significant weaknesses identified in this rebuttal.</Alert>
          ) : (
            <Stack spacing={2}>
              {data.weaknesses.map((weakness) => (
                <Card key={weakness.id} sx={{ backgroundColor: 'var(--ai-bg-secondary)' }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                      <Chip
                        label={weakness.type}
                        size="small"
                        color="warning"
                      />
                      <Box sx={{ flex: 1 }} />
                      <Chip
                        label={`Severity: ${weakness.severity}%`}
                        color={weakness.severity >= 70 ? 'error' : weakness.severity >= 40 ? 'warning' : 'success'}
                        size="small"
                      />
                    </Stack>
                    <Typography variant="body1" sx={{ color: 'var(--ai-text-primary)', mb: 1 }}>
                      {weakness.description}
                    </Typography>
                    {weakness.mitigation && (
                      <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(76, 175, 80, 0.1)', borderRadius: 1 }}>
                        <Typography variant="subtitle2" sx={{ color: '#4CAF50', mb: 1 }}>
                          Potential Mitigation:
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'var(--ai-text-primary)' }}>
                          {weakness.mitigation}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {activeTab === 3 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, color: 'var(--ai-text-primary)' }}>
            Counter-Rebuttals
          </Typography>
          
          {data.counterRebuttals.length === 0 ? (
            <Alert severity="info">No counter-rebuttals identified for this argument.</Alert>
          ) : (
            <Stack spacing={2}>
              {data.counterRebuttals.map((counter) => (
                <Card key={counter.id} sx={{ backgroundColor: 'var(--ai-bg-secondary)' }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ color: 'var(--ai-text-primary)' }}>
                        Counter-Rebuttal
                      </Typography>
                      <Box sx={{ flex: 1 }} />
                      <Chip
                        label={`Strength: ${counter.strength}%`}
                        color={counter.strength >= 70 ? 'error' : counter.strength >= 40 ? 'warning' : 'success'}
                        size="small"
                      />
                    </Stack>
                    <Typography variant="body1" sx={{ color: 'var(--ai-text-primary)', mb: 1 }}>
                      {counter.claim}
                    </Typography>
                    {counter.response && (
                      <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(33, 150, 243, 0.1)', borderRadius: 1 }}>
                        <Typography variant="subtitle2" sx={{ color: '#2196F3', mb: 1 }}>
                          Response:
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'var(--ai-text-primary)' }}>
                          {counter.response}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  )
}

export default EnhancedRebuttal
