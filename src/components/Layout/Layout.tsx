import React from 'react'
import { Link, NavLink } from 'react-router-dom'
import { BottomNavigation, BottomNavigationAction, Paper, Box } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ArticleIcon from '@mui/icons-material/Article'
import HubIcon from '@mui/icons-material/Hub'
import LibrarySidebar from './LibrarySidebar'
import DockBar from './DockBar'
// styles removed for clean slate; will be reintroduced via new spec imports

const PINS_KEY = 'xv_pins'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  React.useEffect(() => {
    const load = () => {
      try {
        localStorage.getItem(PINS_KEY)
      } catch {}
    }
    load()
    const onStorage = (e: StorageEvent) => { if (e.key === PINS_KEY) load() }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return (
    <div className="layout">
      <header className="header">
        <nav className="navbar">
          <Link to="/" className="logo">
            <span className="logo-text">Xervean</span>
            <span className="logo-subtitle">Logic Explorer</span>
          </Link>
          <div className="nav-links">
            <NavLink to="/" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <HomeIcon sx={{ fontSize: 18, mr: 0.5 }} />
              Home
            </NavLink>
            <NavLink to="/viz/zlfn" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <HubIcon sx={{ fontSize: 18, mr: 0.5 }} />
              ZLFN
            </NavLink>
            <NavLink to="/viz/venn" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Venn</NavLink>
            <NavLink to="/viz" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <ArticleIcon sx={{ fontSize: 18, mr: 0.5 }} />
              Visualizer
            </NavLink>
            {/* Documents dropdown removed; documents will be selected from the sidebar */}
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
