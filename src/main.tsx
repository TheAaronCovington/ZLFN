import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from 'react-error-boundary'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { muiTheme } from './styles/muiTheme'
import { LogicSharedProvider } from './context/LogicSharedContext'
import { AccessibilityProvider } from './components/Accessibility/AccessibilityProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AccessibilityProvider options={{
        enableKeyboardNavigation: true,
        enableScreenReaderSupport: true,
        enableHighContrast: true,
        enableReducedMotion: true,
        announceChanges: true
      }}>
        <LogicSharedProvider>
          <ErrorBoundary fallback={<div style={{padding:16}}>An error occurred. Please refresh.</div>}>
            <App />
          </ErrorBoundary>
        </LogicSharedProvider>
      </AccessibilityProvider>
    </ThemeProvider>
  </StrictMode>,
)
