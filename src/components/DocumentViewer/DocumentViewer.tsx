import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import './DocumentViewer.css'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/atom-one-dark.css'
import { logicRemarkPlugin } from './logicRemarkPlugin'
import { getDocumentContent } from '../../services/docs'
import { useLogicShared } from '../../context/LogicSharedContext'

type DocumentViewerProps = {
  filenameOverride?: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(extractText as any).join('')
  // @ts-ignore
  if (children && typeof children === 'object' && 'props' in children) return extractText((children as any).props?.children)
  return ''
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ filenameOverride }) => {
  const routeParams = useParams<{ filename: string }>()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const { currentExpression, setCurrentExpression, expressionHighlightNonce } = useLogicShared()
  const syncedDocId = React.useRef<string | null>(null)
  const [detectedExpressions, setDetectedExpressions] = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      const effective = filenameOverride || routeParams.filename
      setLoading(true)
      if (!effective) {
        setError('No document specified')
        setContent('')
        setLoading(false)
        return
      }
      try {
        const txt = await getDocumentContent(effective)
        if (txt) {
          setContent(txt)
          setError('')
          // Extract ALL expressions from fenced code blocks ```expr|expression|logic
          const regex = /```\s*(expr|expression|logic)\s+([\s\S]*?)```/gi
          const exprs: string[] = []
          let m: RegExpExecArray | null
          while ((m = regex.exec(txt)) !== null) {
            const e = (m[2] || '').trim()
            if (e) exprs.push(e)
          }
          const unique = Array.from(new Set(exprs))
          setDetectedExpressions(unique)
          // Auto-sync first expression if different
          if (unique.length && unique[0] !== currentExpression && syncedDocId.current !== effective) {
            setCurrentExpression(unique[0])
            syncedDocId.current = effective
          }
        } else {
          setContent('')
          setError('Document not found')
        }
      } catch {
        setContent('')
        setError('Failed to load document')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filenameOverride, routeParams.filename, setCurrentExpression, currentExpression])

  useEffect(() => {
    // auto-scroll to active expression block when content or currentExpression changes or highlight nonce updates
    const el = document.querySelector('.expr-active') as HTMLElement | null
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [content, currentExpression, expressionHighlightNonce])

  if (loading) {
    return (
      <div className="document-viewer">
        <div className="loading">Loading document...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="document-viewer">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
          <Link to="/" className="back-link">← Back to Home</Link>
        </div>
      </div>
    )
  }

  const effectiveTitle = (filenameOverride || routeParams.filename)?.replace('_', ' ')

  return (
    <div className="document-viewer">
      <div className="document-header">
        <Link to="/" className="back-link">← Back to Home</Link>
        <h1 className="document-title">{effectiveTitle}</h1>
      </div>

      {detectedExpressions.length > 0 && (
        <div style={{ padding: '8px 12px', margin: '8px 0', border: '1px solid rgba(64,196,255,0.3)', borderRadius: 8, background: 'rgba(20,20,30,0.6)' }}>
          <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--ai-text-secondary)' }}>Expressions found in document:</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {detectedExpressions.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <pre style={{ margin: 0, flex: 1, maxHeight: 90, overflow: 'auto', background: 'rgba(0,0,0,0.25)', padding: '6px 8px', borderRadius: 6 }}><code>{e}</code></pre>
                <button onClick={() => setCurrentExpression(e)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--ai-cyan, #40c4ff)', background: 'transparent', color: 'var(--ai-cyan, #40c4ff)', cursor: 'pointer' }}>Use</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="document-content markdown-content">
        <React.Suspense fallback={<div>Loading renderer…</div>}>
          <PluginsRenderer content={content} activeExpression={currentExpression} />
        </React.Suspense>
      </div>
    </div>
  )
}

const PluginsRenderer: React.FC<{ content: string, activeExpression: string }> = ({ content, activeExpression }) => {
  const [remarkPlugins, setRemarkPlugins] = useState<any[] | null>(null)
  const [rehypePlugins, setRehypePlugins] = useState<any[] | null>(null)
  const { setCurrentExpression } = useLogicShared()

  useEffect(() => {
    Promise.all([
      import('remark-gfm').then(m => m.default),
      import('remark-math').then(m => m.default),
    ]).then(setRemarkPlugins)
    Promise.all([
      import('rehype-katex').then(m => m.default),
      import('rehype-highlight').then(m => m.default),
      import('rehype-raw').then(m => m.default),
    ]).then(setRehypePlugins)
  }, [])

  if (!remarkPlugins || !rehypePlugins) return <div>Loading…</div>

  return (
    <ReactMarkdown 
      remarkPlugins={[...remarkPlugins, logicRemarkPlugin]}
      rehypePlugins={[...rehypePlugins]}
      components={{
        h1: ({ children }) => {
          const text = extractText(children)
          const id = slugify(text)
          return <h1 id={id} className="markdown-h1"><a href={`#${id}`} className="anchor">#</a>{children}</h1>
        },
        h2: ({ children }) => {
          const text = extractText(children)
          const id = slugify(text)
          return <h2 id={id} className="markdown-h2"><a href={`#${id}`} className="anchor">#</a>{children}</h2>
        },
        h3: ({ children }) => {
          const text = extractText(children)
          const id = slugify(text)
          return <h3 id={id} className="markdown-h3"><a href={`#${id}`} className="anchor">#</a>{children}</h3>
        },
        h4: ({ children }) => {
          const text = extractText(children)
          const id = slugify(text)
          return <h4 id={id} className="markdown-h4"><a href={`#${id}`} className="anchor">#</a>{children}</h4>
        },
        p: ({ children }) => <p className="markdown-p">{children}</p>,
        ul: ({ children }) => <ul className="markdown-ul">{children}</ul>,
        ol: ({ children }) => <ol className="markdown-ol">{children}</ol>,
        li: ({ children }) => <li className="markdown-li">{children}</li>,
        table: ({ children }) => <table className="markdown-table">{children}</table>,
        thead: ({ children }) => <thead className="markdown-thead">{children}</thead>,
        tbody: ({ children }) => <tbody className="markdown-tbody">{children}</tbody>,
        tr: ({ children }) => <tr className="markdown-tr">{children}</tr>,
        th: ({ children }) => <th className="markdown-th">{children}</th>,
        td: ({ children }) => <td className="markdown-td">{children}</td>,
        code: ({ children, className }) => {
          const isInline = !className
          const text = String(children ?? '').trim()
          const classNameExtra = !isInline && text === activeExpression ? ' expr-active' : ''
          return isInline ? (
            <code className="markdown-code-inline">{children}</code>
          ) : (
            <code className={`markdown-code-block${classNameExtra}`} onClick={() => setCurrentExpression(text)} style={{ cursor: 'pointer' }}>{children}</code>
          )
        },
        pre: ({ children }) => <pre className="markdown-pre">{children}</pre>,
        blockquote: ({ children }) => <blockquote className="markdown-blockquote">{children}</blockquote>,
        a: ({ href, children }) => (
          <a href={href} className="markdown-link" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export default DocumentViewer
