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
  Keyboard as KeyboardIcon
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

  // Drawers
  controlsOpen: boolean
  inspectorOpen: boolean
  onToggleControls: () => void
  onToggleInspector: () => void

  // Argument filter controls
  argumentIds?: string[]
  selectedArgumentId?: string | null
  onSelectArgument?: (id: string | null) => void

  // View selector
  viewMode?: 'graph' | 'tableau' | 'argument'
  onChangeViewMode?: (mode: 'graph' | 'tableau' | 'argument') => void
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
  argumentIds = [],
  selectedArgumentId = null,
  onSelectArgument
  , viewMode = 'graph', onChangeViewMode
}) => {
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
        backgroundColor: 'rgba(25, 25, 35, 0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(64, 196, 255, 0.2)'
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: 48, gap: 1 }}>
        {/* Search Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 300 }}>
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
                    '& fieldset': { borderColor: 'rgba(64, 196, 255, 0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(64, 196, 255, 0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#40c4ff' }
                  }
                }}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', mr: 1 }} />
                }}
              />
            )}
            freeSolo
          />
          <Tooltip title="Advanced Search">
            <IconButton size="small" onClick={onAdvancedSearch} sx={{ color: '#40c4ff' }}>
              <SearchIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Simulation Controls */}
        <Stack direction="row" spacing={1} sx={{ mx: 2 }}>
          <Tooltip title={simulationMode ? 'Stop Simulation' : 'Start Simulation'}>
            <IconButton 
              size="small" 
              onClick={onToggleSimulation}
              sx={{ color: simulationMode ? '#ff5252' : '#4caf50' }}
            >
              {simulationMode ? <StopIcon /> : <PlayIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset States">
            <IconButton size="small" onClick={onResetStates} sx={{ color: '#40c4ff' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Layout Controls + Argument Filter inline */}
        <Stack direction="row" spacing={1} sx={{ mx: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View selector */}
          <FormControl size="small" sx={{ minWidth: 140, mr: 1 }}>
            <InputLabel id="view-mode-label" sx={{ color: 'rgba(255,255,255,0.8)' }}>View</InputLabel>
            <Select
              labelId="view-mode-label"
              value={viewMode}
              label="View"
              onChange={(e) => onChangeViewMode?.(e.target.value as any)}
              sx={{
                color: '#fff',
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(64, 196, 255, 0.3)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(64, 196, 255, 0.5)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#40c4ff' }
              }}
            >
              <MuiMenuItem value="graph">ZLFN View</MuiMenuItem>
              <MuiMenuItem value="tableau">Tableau View</MuiMenuItem>
              <MuiMenuItem value="argument">Argument View</MuiMenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Fit Graph">
            <IconButton size="small" onClick={onFitGraph} sx={{ color: '#40c4ff' }}>
              <FitIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Center Graph">
            <IconButton size="small" onClick={onCenterGraph} sx={{ color: '#40c4ff' }}>
              <CenterIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Save Layout">
            <IconButton size="small" onClick={onSaveLayout} sx={{ color: '#4caf50' }}>
              <SaveIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear Layout">
            <IconButton size="small" onClick={onClearLayout} sx={{ color: '#ff9800' }}>
              <ClearIcon />
            </IconButton>
          </Tooltip>

          {/* Inline Args */}
          {argumentIds.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ ml: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, opacity: 0.7 }}>Args:</span>
              <Chip
                size="small"
                label="All"
                color={!selectedArgumentId ? 'warning' : 'default'}
                variant={!selectedArgumentId ? 'filled' : 'outlined'}
                onClick={() => onSelectArgument?.(null)}
              />
              {argumentIds.map(aid => (
                <Chip
                  key={aid}
                  size="small"
                  label={aid}
                  color={selectedArgumentId === aid ? 'warning' : 'default'}
                  variant={selectedArgumentId === aid ? 'filled' : 'outlined'}
                  onClick={() => onSelectArgument?.(selectedArgumentId === aid ? null : aid)}
                />
              ))}
            </Stack>
          )}
        </Stack>

        {/* Panel Toggles */}
        <Stack direction="row" spacing={1} sx={{ mx: 2 }}>
          <Tooltip title={controlsOpen ? 'Close Controls' : 'Open Controls'}>
            <IconButton size="small" onClick={onToggleControls} sx={{ color: controlsOpen ? '#ffd740' : '#40c4ff' }}>
              <ControlsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={inspectorOpen ? 'Close Inspector' : 'Open Inspector'}>
            <IconButton size="small" onClick={onToggleInspector} sx={{ color: inspectorOpen ? '#ffd740' : '#40c4ff' }}>
              <InspectorIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

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

        {/* Overflow Menu */}
        <Tooltip title="More Actions">
          <IconButton size="small" onClick={handleOverflowOpen} sx={{ color: '#40c4ff' }}>
            <MoreVertIcon />
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={overflowAnchor}
          open={Boolean(overflowAnchor)}
          onClose={handleOverflowClose}
          PaperProps={{
            sx: {
              backgroundColor: 'rgba(25, 25, 35, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(64, 196, 255, 0.2)',
              '& .MuiMenuItem-root': {
                color: '#ffffff',
                '&:hover': { backgroundColor: 'rgba(64, 196, 255, 0.1)' }
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

      {/* No second-level toolbar; args are inline with layout controls */}
    </AppBar>
  )
}

export default CommandBar
