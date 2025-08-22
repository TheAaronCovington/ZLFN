import React from 'react'
import { Link } from 'react-router-dom'
// styles removed for clean slate; will be reintroduced via new spec imports
import ZlfnGraph from '../Visualizations/ZlfnGraph'
import type { ZlfnNode, ZlfnEdge } from '../Visualizations/ZlfnGraph'
import VennDiagram from '../Visualizations/VennDiagram'
import type { VennDiagramData, NecessarySufficientExample } from '../Visualizations/VennDiagram'

const Home: React.FC = () => {
  const sampleNodes: ZlfnNode[] = [
    { id: 'A', label: 'A', color: '#39ff14' },
    { id: 'B', label: 'B', color: '#40c4ff' },
    { id: 'C', label: 'C', color: '#ff4081' },
  ]
  const sampleEdges: ZlfnEdge[] = [
    { source: 'A', target: 'B' },
    { source: 'B', target: 'C' },
    { source: 'C', target: 'A' },
  ]

  const vennExamples: NecessarySufficientExample[] = [
    { id: 'ex1', title: 'If A then B', necessary: 'A (Necessary)', sufficient: 'B (Sufficient)' }
  ]
  const vennData: VennDiagramData = {
    description: 'Simple necessary & sufficient visualization',
    sets: [
      { label: 'A', items: ['a1', 'a2'], color: '#40c4ff' },
      { label: 'B', items: ['b1'], color: '#00e676' }
    ],
    intersection: ['a∧b']
  }

  return (
    <div className="home">
      <div className="hero-section">
        <h1 className="hero-title">Welcome to Xervean</h1>
        <p className="hero-subtitle">
          Explore philosophical arguments and logical reasoning
        </p>
      </div>
      
      <div style={{ marginBottom: '2rem' }}>
        <ZlfnGraph nodes={sampleNodes} edges={sampleEdges} />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <VennDiagram title="Necessary & Sufficient" data={vennData} type="necessary-sufficient" examples={vennExamples} />
      </div>

      <div className="documents-grid">
        <div className="document-card">
          <h3>TAG Critique</h3>
          <p>A comprehensive critique of the Transcendental Argument for God</p>
          <Link to="/document/TAG_Critique" className="card-link">
            Read Document →
          </Link>
        </div>
        
        <div className="document-card">
          <h3>Logic Demo</h3>
          <p>Demonstrations and examples of logical reasoning</p>
          <Link to="/document/logic_demo" className="card-link">
            Read Document →
          </Link>
        </div>
        
        <div className="document-card">
          <h3>Test Document</h3>
          <p>Test document for exploring the document viewer</p>
          <Link to="/document/test" className="card-link">
            Read Document →
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Home
