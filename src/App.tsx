import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import Layout from './components/Layout/Layout'
import Home from './components/Home/Home'
const DocumentViewer = lazy(() => import('./components/DocumentViewer/DocumentViewer'))
const VizZlfn = lazy(() => import('./pages/VizZlfn'))
const VizVenn = lazy(() => import('./pages/VizVenn'))
const VizSymbols = lazy(() => import('./pages/VizSymbols'))
const LogicVisualizer = lazy(() => import('./pages/LogicVisualizer'))
const Phase1Verification = lazy(() => import('./test/Phase1Verification'))
const Phase2Demo = lazy(() => import('./pages/Phase2Demo'))
// styles removed for clean slate; will be reintroduced via new spec imports

function App() {
  return (
    <Router>
      <Layout>
        <Suspense fallback={
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              minHeight: '50vh',
              flexDirection: 'column',
              gap: '1rem'
            }}
            role="status"
            aria-live="polite"
            aria-label="Loading page content"
          >
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '3px solid var(--ai-border-secondary)', 
              borderTop: '3px solid var(--ai-cyan)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <span style={{ color: 'var(--ai-text-secondary)' }}>Loading…</span>
          </div>
        }>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/document/:filename" element={<DocumentViewer />} />
            <Route path="/viz/zlfn" element={<VizZlfn />} />
            <Route path="/viz/venn" element={<VizVenn />} />
            <Route path="/viz/symbols" element={<VizSymbols />} />
            <Route path="/viz" element={<LogicVisualizer />} />
            <Route path="/test/phase1" element={<Phase1Verification />} />
            <Route path="/demo/phase2" element={<Phase2Demo />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  )
}

export default App
