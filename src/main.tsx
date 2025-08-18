import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { muiTheme } from './styles/muiTheme'
import { LogicSharedProvider } from './context/LogicSharedContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <LogicSharedProvider>
        <App />
      </LogicSharedProvider>
    </ThemeProvider>
  </StrictMode>,
)
