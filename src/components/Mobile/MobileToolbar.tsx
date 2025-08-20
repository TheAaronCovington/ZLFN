import React, { useState } from 'react'
import {
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Box,
  Typography,
  Divider,
  Chip
} from '@mui/material'
import {
  Hub as GraphIcon,
  Notes as NotesIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  MoreVert as MoreIcon,
  Close as CloseIcon,
  FileUpload as ImportIcon,
  FileDownload as ExportIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Visibility as ViewIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material'

interface MobileToolbarProps {
  // Core actions
  onSaveLayout?: () => void
  onClearLayout?: () => void
  onUndoLayout?: () => void
  onRedoLayout?: () => void
  onFitGraph?: () => void
  onCenterGraph?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  
  // Toggle states
  notesEnabled?: boolean
  onNotesToggle?: () => void
  
  // Advanced actions
  onImport?: () => void
  onExport?: () => void
  onSearch?: () => void
  onSettings?: () => void
  
  // Status indicators
  notesCount?: number
  canUndo?: boolean
  canRedo?: boolean
  
  // Layout config
  position?: 'bottom' | 'top'
}

const MobileToolbar: React.FC<MobileToolbarProps> = ({
  onSaveLayout,
  onClearLayout,
  onUndoLayout,
  onRedoLayout,
  onFitGraph,
  onCenterGraph,
  onZoomIn,
  onZoomOut,
  notesEnabled = false,
  onNotesToggle,
  onImport,
  onExport,
  onSearch,
  onSettings,
  notesCount = 0,
  canUndo = false,
  canRedo = false,
  position = 'bottom'
}) => {
  const [activeTab, setActiveTab] = useState(0)
  const [speedDialOpen, setSpeedDialOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Primary actions for bottom navigation
  const primaryActions = [
    {
      label: 'Graph',
      icon: <GraphIcon />,
      action: () => setActiveTab(0)
    },
    {
      label: `Notes${notesCount > 0 ? ` (${notesCount})` : ''}`,
      icon: <NotesIcon color={notesEnabled ? 'primary' : 'inherit'} />,
      action: onNotesToggle
    },
    {
      label: 'View',
      icon: <ViewIcon />,
      action: () => setSpeedDialOpen(true)
    },
    {
      label: 'More',
      icon: <MoreIcon />,
      action: () => setDrawerOpen(true)
    }
  ]

  // Speed dial actions for quick access
  const speedDialActions = [
    {
      icon: <ZoomInIcon />,
      name: 'Zoom In',
      action: onZoomIn
    },
    {
      icon: <ZoomOutIcon />,
      name: 'Zoom Out', 
      action: onZoomOut
    },
    {
      icon: <CenterIcon />,
      name: 'Center',
      action: onCenterGraph
    },
    {
      icon: <TimelineIcon />,
      name: 'Fit Graph',
      action: onFitGraph
    }
  ]

  // Drawer menu items
  const drawerItems = [
    {
      section: 'Layout',
      items: [
        { icon: <SaveIcon />, text: 'Save Layout', action: onSaveLayout },
        { icon: <ClearIcon />, text: 'Clear Layout', action: onClearLayout },
        { icon: <UndoIcon />, text: 'Undo', action: onUndoLayout, disabled: !canUndo },
        { icon: <RedoIcon />, text: 'Redo', action: onRedoLayout, disabled: !canRedo }
      ]
    },
    {
      section: 'File',
      items: [
        { icon: <ImportIcon />, text: 'Import', action: onImport },
        { icon: <ExportIcon />, text: 'Export', action: onExport }
      ]
    },
    {
      section: 'Tools',
      items: [
        { icon: <SearchIcon />, text: 'Search', action: onSearch },
        { icon: <SettingsIcon />, text: 'Settings', action: onSettings }
      ]
    }
  ]

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
    if (primaryActions[newValue]?.action) {
      primaryActions[newValue].action()
    }
  }

  const handleSpeedDialAction = (action?: () => void) => {
    if (action) action()
    setSpeedDialOpen(false)
  }

  const handleDrawerItemClick = (action?: () => void) => {
    if (action) action()
    setDrawerOpen(false)
  }

  return (
    <>
      {/* Main Bottom Navigation */}
      <Paper
        sx={{
          position: 'fixed',
          [position]: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          borderRadius: position === 'bottom' ? '16px 16px 0 0' : '0 0 16px 16px'
        }}
        elevation={8}
      >
        <BottomNavigation
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            height: 64,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 44, // Ensure touch targets are large enough
              '&.Mui-selected': {
                color: 'primary.main'
              }
            }
          }}
        >
          {primaryActions.map((action, index) => (
            <BottomNavigationAction
              key={index}
              label={action.label}
              icon={action.icon}
              sx={{
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.75rem',
                  '&.Mui-selected': {
                    fontSize: '0.75rem'
                  }
                }
              }}
            />
          ))}
        </BottomNavigation>

        {/* Notes count indicator */}
        {notesCount > 0 && (
          <Chip
            label={notesCount}
            size="small"
            color="primary"
            sx={{
              position: 'absolute',
              top: 8,
              right: 80,
              minWidth: 20,
              height: 20,
              '& .MuiChip-label': {
                fontSize: '0.7rem',
                px: 0.5
              }
            }}
          />
        )}
      </Paper>

      {/* Speed Dial for View Actions */}
      <SpeedDial
        ariaLabel="View actions"
        sx={{
          position: 'fixed',
          [position === 'bottom' ? 'bottom' : 'top']: 80,
          right: 16,
          zIndex: 999
        }}
        icon={<SpeedDialIcon />}
        open={speedDialOpen}
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        direction={position === 'bottom' ? 'up' : 'down'}
      >
        {speedDialActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={() => handleSpeedDialAction(action.action)}
            sx={{
              '& .MuiFab-root': {
                minHeight: 44,
                minWidth: 44
              }
            }}
          />
        ))}
      </SpeedDial>

      {/* Drawer for More Actions */}
      <Drawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            borderRadius: '16px 16px 0 0',
            maxHeight: '70vh'
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Actions</Typography>
            <IconButton
              onClick={() => setDrawerOpen(false)}
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {drawerItems.map((section, sectionIndex) => (
            <Box key={sectionIndex}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, mt: sectionIndex > 0 ? 2 : 0 }}>
                {section.section}
              </Typography>
              <List dense>
                {section.items.map((item, itemIndex) => (
                  <ListItem
                    key={itemIndex}
                    onClick={() => handleDrawerItemClick(item.action)}
                    sx={{
                      minHeight: 48, // Ensure touch targets
                      borderRadius: 1,
                      mb: 0.5,
                      cursor: 'pointer',
                      opacity: item.disabled ? 0.5 : 1,
                      pointerEvents: item.disabled ? 'none' : 'auto',
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.text}
                      primaryTypographyProps={{
                        fontSize: '0.9rem'
                      }}
                    />
                  </ListItem>
                ))}
              </List>
              {sectionIndex < drawerItems.length - 1 && <Divider sx={{ my: 1 }} />}
            </Box>
          ))}
        </Box>
      </Drawer>
    </>
  )
}

export default MobileToolbar
