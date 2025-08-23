import React from 'react'
import {
  Box,
  FormControlLabel,
  Switch,
  Typography,
  Divider,
  Tooltip,
  IconButton,
  Collapse
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import InfoIcon from '@mui/icons-material/Info'

export interface SyntaxHighlightingOptions {
  enableTooltips: boolean
  enableVariableMapping: boolean
  enableQuantifierHighlighting: boolean
  enablePredicateHighlighting: boolean
}

interface SyntaxHighlightingSettingsProps {
  options: SyntaxHighlightingOptions
  onChange: (options: SyntaxHighlightingOptions) => void
  compact?: boolean
}

export const SyntaxHighlightingSettings: React.FC<SyntaxHighlightingSettingsProps> = ({
  options,
  onChange,
  compact = false
}) => {
  const [expanded, setExpanded] = React.useState(false)

  const handleChange = (key: keyof SyntaxHighlightingOptions) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...options,
      [key]: event.target.checked
    })
  }

  if (compact) {
    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <SettingsIcon sx={{ fontSize: 16, mr: 1, color: 'var(--ai-text-secondary)' }} />
          <Typography variant="caption" sx={{ color: 'var(--ai-text-secondary)', flexGrow: 1 }}>
            Syntax Highlighting
          </Typography>
          <IconButton 
            size="small" 
            onClick={() => setExpanded(!expanded)}
            sx={{ color: 'var(--ai-text-secondary)' }}
          >
            <SettingsIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
        
        <Collapse in={expanded}>
          <Box sx={{ 
            pl: 2, 
            borderLeft: '2px solid var(--ai-border-subtle)',
            backgroundColor: 'var(--ai-bg-elevated)',
            borderRadius: 1,
            p: 1
          }}>
            <FormControlLabel
              control={
                <Switch
                  checked={options.enableTooltips}
                  onChange={handleChange('enableTooltips')}
                  size="small"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="caption">Tooltips</Typography>
                  <Tooltip title="Show descriptive tooltips when hovering over logic symbols and terms">
                    <InfoIcon sx={{ fontSize: 12, ml: 0.5, opacity: 0.7 }} />
                  </Tooltip>
                </Box>
              }
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={options.enableVariableMapping}
                  onChange={handleChange('enableVariableMapping')}
                  size="small"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="caption">Variable Mapping</Typography>
                  <Tooltip title="Highlight and map logical variables (P, Q, R, etc.) throughout the document">
                    <InfoIcon sx={{ fontSize: 12, ml: 0.5, opacity: 0.7 }} />
                  </Tooltip>
                </Box>
              }
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={options.enableQuantifierHighlighting}
                  onChange={handleChange('enableQuantifierHighlighting')}
                  size="small"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="caption">Quantifiers</Typography>
                  <Tooltip title="Special highlighting for quantifiers (∀, ∃, etc.)">
                    <InfoIcon sx={{ fontSize: 12, ml: 0.5, opacity: 0.7 }} />
                  </Tooltip>
                </Box>
              }
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={options.enablePredicateHighlighting}
                  onChange={handleChange('enablePredicateHighlighting')}
                  size="small"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="caption">Predicates</Typography>
                  <Tooltip title="Highlight predicate functions (P(x), R(x,y), etc.)">
                    <InfoIcon sx={{ fontSize: 12, ml: 0.5, opacity: 0.7 }} />
                  </Tooltip>
                </Box>
              }
            />
          </Box>
        </Collapse>
      </Box>
    )
  }

  return (
    <Box sx={{ 
      p: 2, 
      backgroundColor: 'var(--ai-bg-secondary)',
      borderRadius: 2,
      border: '1px solid var(--ai-border-primary)'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SettingsIcon sx={{ mr: 1, color: 'var(--ai-accent-primary)' }} />
        <Typography variant="h6" sx={{ color: 'var(--ai-text-primary)' }}>
          Syntax Highlighting Settings
        </Typography>
      </Box>
      
      <Divider sx={{ mb: 2, borderColor: 'var(--ai-border-subtle)' }} />
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={options.enableTooltips}
              onChange={handleChange('enableTooltips')}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: 'var(--ai-cyan)',
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: 'var(--ai-cyan)',
                },
              }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Interactive Tooltips
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--ai-text-secondary)' }}>
                Show descriptive tooltips when hovering over logic symbols and terms
              </Typography>
            </Box>
          }
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={options.enableVariableMapping}
              onChange={handleChange('enableVariableMapping')}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: 'var(--ai-cyan)',
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: 'var(--ai-cyan)',
                },
              }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Variable Mapping
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--ai-text-secondary)' }}>
                Highlight and map logical variables (P, Q, R, etc.) throughout the document
              </Typography>
            </Box>
          }
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={options.enableQuantifierHighlighting}
              onChange={handleChange('enableQuantifierHighlighting')}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: 'var(--ai-cyan)',
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: 'var(--ai-cyan)',
                },
              }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Enhanced Quantifier Highlighting
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--ai-text-secondary)' }}>
                Special highlighting and styling for quantifiers (∀, ∃, ∄, ∃!)
              </Typography>
            </Box>
          }
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={options.enablePredicateHighlighting}
              onChange={handleChange('enablePredicateHighlighting')}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: 'var(--ai-cyan)',
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: 'var(--ai-cyan)',
                },
              }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Predicate Function Highlighting
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--ai-text-secondary)' }}>
                Highlight predicate functions and their applications (P(x), R(x,y), etc.)
              </Typography>
            </Box>
          }
        />
      </Box>
    </Box>
  )
}

export default SyntaxHighlightingSettings
