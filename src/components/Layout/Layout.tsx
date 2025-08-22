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
      <header className="header" role="banner">
        <nav className="navbar" role="navigation" aria-label="Main navigation">
          <Link 
            to="/" 
            className="logo" 
            aria-label="Xervean Logic Explorer - Home"
            tabIndex={0}
          >
            <span className="logo-text">Xervean</span>
            <span className="logo-subtitle">Logic Explorer</span>
          </Link>
          <div className="nav-links" role="menubar">
            <NavLink 
              to="/" 
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              role="menuitem"
              aria-label="Navigate to Home page"
              tabIndex={0}
            >
              <HomeIcon sx={{ fontSize: 18, mr: 0.5 }} aria-hidden="true" />
              Home
            </NavLink>
            <NavLink 
              to="/viz/zlfn" 
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              role="menuitem"
              aria-label="Navigate to ZLFN Graph visualization"
              tabIndex={0}
            >
              <HubIcon sx={{ fontSize: 18, mr: 0.5 }} aria-hidden="true" />
              ZLFN
            </NavLink>
            <NavLink 
              to="/viz/venn" 
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              role="menuitem"
              aria-label="Navigate to Venn Diagram visualization"
              tabIndex={0}
            >
              Venn
            </NavLink>
            <NavLink 
              to="/viz" 
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              role="menuitem"
              aria-label="Navigate to Logic Visualizer"
              tabIndex={0}
            >
              <ArticleIcon sx={{ fontSize: 18, mr: 0.5 }} aria-hidden="true" />
              Visualizer
            </NavLink>
            {/* Documents dropdown removed; documents will be selected from the sidebar */}
            <Box role="complementary" aria-label="Document library">
              <LibrarySidebar />
            </Box>
          </div>
        </nav>
      </header>
      <main className="main-content" role="main" id="main-content" tabIndex={-1}>
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
