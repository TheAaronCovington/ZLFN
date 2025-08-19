import React from 'react'
import { Link } from 'react-router-dom'
import { BottomNavigation, BottomNavigationAction, Paper, Box, Chip } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ArticleIcon from '@mui/icons-material/Article'
import HubIcon from '@mui/icons-material/Hub'
import PushPinIcon from '@mui/icons-material/PushPin'
import LibrarySidebar from './LibrarySidebar'
import DockBar from './DockBar'
import './Layout.css'

const PINS_KEY = 'xv_pins'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [pinsSet, setPinsSet] = React.useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(PINS_KEY)
      const arr: string[] = raw ? JSON.parse(raw) : []
      return new Set(arr)
    } catch { return new Set<string>() }
  })
  React.useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(PINS_KEY)
        const arr: string[] = raw ? JSON.parse(raw) : []
        setPinsSet(new Set(arr))
      } catch {}
    }
    load()
    const onStorage = (e: StorageEvent) => { if (e.key === PINS_KEY) load() }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  const isPinned = (id: string) => pinsSet.has(id)
  return (
    <div className="layout">
      <header className="header">
        <nav className="navbar">
          <Link to="/" className="logo">
            <span className="logo-text">Xervean</span>
            <span className="logo-subtitle">Logic Explorer</span>
          </Link>
          <div className="nav-links">
            <Link to="/" className="nav-link">
              <HomeIcon sx={{ fontSize: 18, mr: 0.5 }} />
              Home
            </Link>
            <Link to="/viz/zlfn" className="nav-link">
              <HubIcon sx={{ fontSize: 18, mr: 0.5 }} />
              ZLFN
            </Link>
            <Link to="/viz/venn" className="nav-link">Venn</Link>
            <Link to="/viz/ast" className="nav-link">AST</Link>
            <Link to="/viz" className="nav-link">
              <ArticleIcon sx={{ fontSize: 18, mr: 0.5 }} />
              Visualizer
            </Link>
            <div className="dropdown">
              <span className="nav-link dropdown-toggle">
                <ArticleIcon sx={{ fontSize: 18, mr: 0.5 }} />
                Documents
              </span>
              <div className="dropdown-content">
                <Link to="/document/TAG_Critique" className="dropdown-link">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>TAG Critique</span>
                    {isPinned('TAG_Critique') && <Chip size="small" icon={<PushPinIcon sx={{ fontSize: 12 }} />} label="Pinned" sx={{ 
                      ml: 1, 
                      height: 18, 
                      backgroundColor: 'rgba(64,196,255,0.15)', 
                      color: '#40c4ff',
                      fontSize: 10
                    }} />}
                  </Box>
                </Link>
                <Link to="/document/logic_demo" className="dropdown-link">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>Logic Demo</span>
                    {isPinned('logic_demo') && <Chip size="small" icon={<PushPinIcon sx={{ fontSize: 12 }} />} label="Pinned" sx={{ 
                      ml: 1, 
                      height: 18, 
                      backgroundColor: 'rgba(64,196,255,0.15)', 
                      color: '#40c4ff',
                      fontSize: 10
                    }} />}
                  </Box>
                </Link>
                <Link to="/document/test" className="dropdown-link">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>Test Document</span>
                    {isPinned('test') && <Chip size="small" icon={<PushPinIcon sx={{ fontSize: 12 }} />} label="Pinned" sx={{ 
                      ml: 1, 
                      height: 18, 
                      backgroundColor: 'rgba(64,196,255,0.15)', 
                      color: '#40c4ff',
                      fontSize: 10
                    }} />}
                  </Box>
                </Link>
              </div>
            </div>
            <Box>
              <LibrarySidebar />
            </Box>
          </div>
        </nav>
      </header>
      <main className="main-content">
        {children}
      </main>
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={6}>
        <BottomNavigation showLabels>
          <BottomNavigationAction label="Home" icon={<HomeIcon />} component={Link as any} to="/" />
          <BottomNavigationAction label="Docs" icon={<ArticleIcon />} component={Link as any} to="/document/TAG_Critique" />
          <BottomNavigationAction label="Graph" icon={<HubIcon />} component={Link as any} to="/" />
        </BottomNavigation>
      </Paper>
      <DockBar />
    </div>
  )
}

export default Layout
