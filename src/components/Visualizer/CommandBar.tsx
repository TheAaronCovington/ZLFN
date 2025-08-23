import React from 'react'
import {
  AppBar,
  Toolbar,
  IconButton,
  TextField,
  Autocomplete,

  Menu,
  Tooltip,
  Box,
  Chip,
  Stack,
  Select,
  MenuItem as MuiMenuItem,
  InputLabel,
  FormControl
} from '@mui/material'
import ArgumentSelector from './ArgumentSelector'
import { useLogicShared } from '../../context/LogicSharedContext'
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  CenterFocusStrong as CenterIcon,
  FitScreen as FitIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Speed as SpeedIcon,
  Help as HelpIcon,
  Keyboard as KeyboardIcon,
  Add as AddIcon
} from '@mui/icons-material'
import { Tune as ControlsIcon, Visibility as InspectorIcon } from '@mui/icons-material'

interface CommandBarProps {
  // Search
  searchValue: string
  searchOptions: string[]
  onSearchChange: (value: string) => void
  onSearchSelect: (value: string) => void
  onAdvancedSearch: () => void
  
  // Simulation
  simulationMode: boolean
  onToggleSimulation: () => void
  onResetStates: () => void
  
  // Layout
  onFitGraph: () => void
  onCenterGraph: () => void
  onSaveLayout: () => void
  onClearLayout: () => void
  
  // Overflow actions
  onExport: () => void
  onImport: () => void
  onTogglePerformance: () => void
  onShowShortcuts: () => void
  onShowHelp: () => void
  
  // Status
  isPerformanceVisible: boolean

  // Advanced Features (ZLFN only)
  showRivers?: boolean
  onToggleRivers?: () => void
  bayesianEnabled?: boolean
  onToggleBayesian?: () => void

  // Drawers
  controlsOpen: boolean
  inspectorOpen: boolean
  onToggleControls: () => void
  onToggleInspector: () => void

  // Unified argument selector (now handled internally via context)

  // View selector
  viewMode?: 'graph' | 'argument'
  onChangeViewMode?: (mode: 'graph' | 'argument') => void

  // Object Form
  onCreateArgument?: () => void
}

export const CommandBar: React.FC<CommandBarProps> = ({
  searchValue,
  searchOptions,
  onSearchChange,
  onSearchSelect,
  onAdvancedSearch,
  simulationMode,
  onToggleSimulation,
  onResetStates,
  onFitGraph,
  onCenterGraph,
  onSaveLayout,
  onClearLayout,
  showRivers,
  onToggleRivers,
  bayesianEnabled,
  onToggleBayesian,
  onExport,
  onImport,
  onTogglePerformance,
  onShowShortcuts,
  onShowHelp,
  isPerformanceVisible,
  controlsOpen,
  inspectorOpen,
  onToggleControls,
  onToggleInspector,
  viewMode = 'graph', 
  onChangeViewMode,
  onCreateArgument
}) => {
  // Access unified data from context
  const { unifiedData, setSelectedArgumentId } = useLogicShared()
  const [overflowAnchor, setOverflowAnchor] = React.useState<null | HTMLElement>(null)

  const handleOverflowOpen = (event: React.MouseEvent<HTMLElement>) => {
    setOverflowAnchor(event.currentTarget)
  }

  const handleOverflowClose = () => {
    setOverflowAnchor(null)
  }

  const handleOverflowAction = (action: () => void) => {
    action()
    handleOverflowClose()
  }

  return (
    <AppBar 
      position="static" 
      elevation={1}
      sx={{ 
        backgroundColor: 'var(--ai-bg-secondary)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--ai-border-primary)'
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: 48, gap: 1 }}>
        {/* Search Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 250 }}>
          <Autocomplete
            size="small"
            options={searchOptions}
            value={searchValue}
            onChange={(_, value) => onSearchSelect(value || '')}
            onInputChange={(_, value) => onSearchChange(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search nodes..."
                variant="outlined"
                size="small"
                sx={{ 
                  minWidth: 200,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    '& fieldset': { borderColor: 'var(--ai-border-secondary)' },
                    '&:hover fieldset': { borderColor: 'var(--ai-border-primary)' },
                    '&.Mui-focused fieldset': { 
                      borderColor: 'var(--ai-cyan)',
                      boxShadow: 'var(--ai-glow-cyan)'
                    }
                  }
                }}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <SearchIcon sx={{ color: 'var(--ai-text-tertiary)', mr: 1 }} />,
                  endAdornment: (
                    <Tooltip title="Advanced Search (Ctrl+F)">
                      <IconButton 
                        size="small" 
                        onClick={onAdvancedSearch} 
                        sx={{ 
                          color: 'var(--ai-text-secondary)',
                          '&:hover': { color: 'var(--ai-cyan)' }
                        }}
                      >
                        <SearchIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )
                }}
              />
            )}
            freeSolo
          />
        </Box>

        {/* Simulation Controls */}
        <Stack direction="row" spacing={1} sx={{ mx: 2 }}>
          <Tooltip title={simulationMode ? 'Stop Simulation' : 'Start Simulation'}>
            <IconButton 
              size="small" 
              onClick={onToggleSimulation}
              sx={{ color: simulationMode ? 'var(--ai-red)' : 'var(--ai-green)' }}
            >
              {simulationMode ? <StopIcon /> : <PlayIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset States">
            <IconButton size="small" onClick={onResetStates} sx={{ color: 'var(--ai-cyan)' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Layout Controls + Argument Filter inline */}
        <Stack direction="row" spacing={1} sx={{ mx: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View selector */}
          <FormControl size="small" sx={{ minWidth: 140, mr: 1 }}>
            <InputLabel id="view-mode-label" sx={{ color: 'var(--ai-text-secondary)' }}>View</InputLabel>
            <Select
              labelId="view-mode-label"
              value={viewMode}
              label="View"
              onChange={(e) => onChangeViewMode?.(e.target.value as any)}
              sx={{
                color: 'var(--ai-text-primary)',
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'var(--ai-border-secondary)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--ai-border-primary)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { 
                  borderColor: 'var(--ai-cyan)',
                  boxShadow: 'var(--ai-glow-cyan)'
                }
              }}
            >
              <MuiMenuItem value="graph">ZLFN View</MuiMenuItem>
              <MuiMenuItem value="argument">Argument View</MuiMenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Fit Graph">
            <IconButton size="small" onClick={onFitGraph} sx={{ color: 'var(--ai-cyan)' }}>
              <FitIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Center Graph">
            <IconButton size="small" onClick={onCenterGraph} sx={{ color: 'var(--ai-cyan)' }}>
              <CenterIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Save Layout">
            <IconButton size="small" onClick={onSaveLayout} sx={{ color: 'var(--ai-green)' }}>
              <SaveIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear Layout">
            <IconButton size="small" onClick={onClearLayout} sx={{ color: 'var(--ai-orange)' }}>
              <ClearIcon />
            </IconButton>
          </Tooltip>

          {/* Advanced Features (ZLFN only) */}
          {viewMode === 'graph' && (
            <>
              <Tooltip title="Toggle Flow Rivers">
                <IconButton 
                  size="small" 
                  onClick={onToggleRivers}
                  sx={{ 
                    color: showRivers ? 'var(--ai-pink)' : 'var(--ai-text-secondary)',
                    backgroundColor: showRivers ? 'rgba(255, 64, 129, 0.1)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 64, 129, 0.2)',
                      color: 'var(--ai-pink)'
                    }
                  }}
                >
                  🌊
                </IconButton>
              </Tooltip>
              <Tooltip title="Toggle Bayesian Mode">
                <IconButton 
                  size="small" 
                  onClick={onToggleBayesian}
                  sx={{ 
                    color: bayesianEnabled ? 'var(--ai-purple)' : 'var(--ai-text-secondary)',
                    backgroundColor: bayesianEnabled ? 'rgba(187, 134, 252, 0.1)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(187, 134, 252, 0.2)',
                      color: 'var(--ai-purple)'
                    }
                  }}
                >
                  🧠
                </IconButton>
              </Tooltip>
            </>
          )}

          {/* Unified Argument Selector */}
          {unifiedData.arguments.length > 0 && (
            <ArgumentSelector
              arguments={unifiedData.arguments}
              selectedArgumentId={unifiedData.selectedArgumentId}
              onArgumentSelect={setSelectedArgumentId}
              label="Argument"
              size="small"
              minWidth={180}
            />
          )}
        </Stack>

        {/* Status Indicators */}
        <Stack direction="row" spacing={1} sx={{ mr: 2 }}>
          {isPerformanceVisible && (
            <Chip 
              label="Performance" 
              size="small" 
              color="info" 
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          )}
        </Stack>

        {/* Create Argument FAB */}
        {onCreateArgument && (
          <Tooltip title="Create New Argument">
            <IconButton
              onClick={onCreateArgument}
              sx={{
                width: 48,
                height: 48,
                background: 'linear-gradient(135deg, var(--ai-cyan), var(--ai-blue))',
                borderRadius: '50%',
                boxShadow: 'var(--ai-glow-cyan)',
                color: 'white',
                mr: 1,
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: '0 0 20px rgba(0, 229, 255, 0.6)',
                  background: 'linear-gradient(135deg, var(--ai-blue), var(--ai-purple))',
                },
                '&:active': {
                  transform: 'scale(0.95)',
                },
                transition: 'all var(--ai-transition-normal)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                  animation: 'fabSweep 3s infinite linear',
                  '@keyframes fabSweep': {
                    '0%': { left: '-100%' },
                    '100%': { left: '100%' }
                  }
                }
              }}
            >
              <AddIcon sx={{ fontSize: 28, position: 'relative', zIndex: 1 }} />
            </IconButton>
          </Tooltip>
        )}

        {/* Overflow Menu */}
        <Tooltip title="More Actions">
          <IconButton size="small" onClick={handleOverflowOpen} sx={{ color: 'var(--ai-cyan)' }}>
            <MoreVertIcon />
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={overflowAnchor}
          open={Boolean(overflowAnchor)}
          onClose={handleOverflowClose}
          PaperProps={{
            sx: {
              backgroundColor: 'var(--ai-bg-elevated)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--ai-border-primary)',
              boxShadow: 'var(--ai-glow-cyan)',
              '& .MuiMenuItem-root': {
                color: 'var(--ai-text-primary)',
                '&:hover': { backgroundColor: 'rgba(0, 229, 255, 0.1)' }
              }
            }
          }}
        >
          <MuiMenuItem onClick={() => handleOverflowAction(onToggleControls)}>
            <ControlsIcon sx={{ mr: 1 }} />
            {controlsOpen ? 'Close Controls' : 'Open Controls'}
          </MuiMenuItem>
          <MuiMenuItem onClick={() => handleOverflowAction(onToggleInspector)}>
            <InspectorIcon sx={{ mr: 1 }} />
            {inspectorOpen ? 'Close Inspector' : 'Open Inspector'}
          </MuiMenuItem>
          <Box sx={{ my: 0.5 }} />
          <MuiMenuItem onClick={() => handleOverflowAction(onExport)}>
            <DownloadIcon sx={{ mr: 1 }} />
            Export
          </MuiMenuItem>
          <MuiMenuItem onClick={() => handleOverflowAction(onImport)}>
            <UploadIcon sx={{ mr: 1 }} />
            Import
          </MuiMenuItem>
          <MuiMenuItem onClick={() => handleOverflowAction(onTogglePerformance)}>
            <SpeedIcon sx={{ mr: 1 }} />
            Performance Monitor
          </MuiMenuItem>
          <MuiMenuItem onClick={() => handleOverflowAction(onShowShortcuts)}>
            <KeyboardIcon sx={{ mr: 1 }} />
            Keyboard Shortcuts
          </MuiMenuItem>
          <MuiMenuItem onClick={() => handleOverflowAction(onShowHelp)}>
            <HelpIcon sx={{ mr: 1 }} />
            Help
          </MuiMenuItem>
        </Menu>
      </Toolbar>

      {/* Second-level toolbar for panel controls */}
      <Toolbar 
        variant="dense" 
        sx={{ 
          minHeight: 36, 
          backgroundColor: 'var(--ai-bg-elevated)',
          borderBottom: '1px solid var(--ai-border-subtle)',
          justifyContent: 'flex-end',
          gap: 1,
          px: 2
        }}
      >
        <Stack direction="row" spacing={1}>
          <Tooltip title={controlsOpen ? 'Close Controls' : 'Open Controls'}>
            <IconButton 
              size="small" 
              onClick={onToggleControls} 
              sx={{ 
                color: controlsOpen ? 'var(--ai-gold)' : 'var(--ai-cyan)',
                '&:hover': { backgroundColor: 'rgba(0, 229, 255, 0.1)' }
              }}
            >
              <ControlsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={inspectorOpen ? 'Close Inspector' : 'Open Inspector'}>
            <IconButton 
              size="small" 
              onClick={onToggleInspector} 
              sx={{ 
                color: inspectorOpen ? 'var(--ai-gold)' : 'var(--ai-cyan)',
                '&:hover': { backgroundColor: 'rgba(0, 229, 255, 0.1)' }
              }}
            >
              <InspectorIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  )
}

export default CommandBar
