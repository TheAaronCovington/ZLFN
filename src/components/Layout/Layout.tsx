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
            Xervean
          </Link>
          <div className="nav-links">
            <Link to="/" className="nav-link">Home</Link>
            <Link to="/viz/zlfn" className="nav-link">ZLFN</Link>
            <Link to="/viz/venn" className="nav-link">Venn</Link>
            <Link to="/viz/ast" className="nav-link">AST</Link>
            <Link to="/viz" className="nav-link">Visualizer</Link>
            <div className="dropdown">
              <span className="nav-link dropdown-toggle">Documents</span>
              <div className="dropdown-content">
                <Link to="/document/TAG_Critique" className="dropdown-link">
                  TAG Critique {isPinned('TAG_Critique') && <Chip size="small" icon={<PushPinIcon sx={{ fontSize: 14 }} />} label="Pinned" variant="outlined" sx={{ ml: 1, height: 20 }} />}
                </Link>
                <Link to="/document/logic_demo" className="dropdown-link">
                  Logic Demo {isPinned('logic_demo') && <Chip size="small" icon={<PushPinIcon sx={{ fontSize: 14 }} />} label="Pinned" variant="outlined" sx={{ ml: 1, height: 20 }} />}
                </Link>
                <Link to="/document/test" className="dropdown-link">
                  Test Document {isPinned('test') && <Chip size="small" icon={<PushPinIcon sx={{ fontSize: 14 }} />} label="Pinned" variant="outlined" sx={{ ml: 1, height: 20 }} />}
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
