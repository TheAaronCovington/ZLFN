import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import Layout from './components/Layout/Layout'
import Home from './components/Home/Home'
const DocumentViewer = lazy(() => import('./components/DocumentViewer/DocumentViewer'))
const VizZlfn = lazy(() => import('./pages/VizZlfn'))
const VizVenn = lazy(() => import('./pages/VizVenn'))
const VizAst = lazy(() => import('./pages/VizAst'))
const VizSymbols = lazy(() => import('./pages/VizSymbols'))
const LogicVisualizer = lazy(() => import('./pages/LogicVisualizer'))
const Phase1Verification = lazy(() => import('./test/Phase1Verification'))
const Phase2Demo = lazy(() => import('./pages/Phase2Demo'))
import './App.css'

function App() {
  return (
    <Router>
      <Layout>
        <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/document/:filename" element={<DocumentViewer />} />
            <Route path="/viz/zlfn" element={<VizZlfn />} />
            <Route path="/viz/venn" element={<VizVenn />} />
            <Route path="/viz/ast" element={<VizAst />} />
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
