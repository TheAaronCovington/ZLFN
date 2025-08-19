import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import './DocumentViewer.css'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/atom-one-dark.css'
import { logicRemarkPlugin } from './logicRemarkPlugin'
import { getDocumentContent } from '../../services/docs'
import { useLogicShared } from '../../context/LogicSharedContext'
import { Box, Typography, Chip } from '@mui/material'
import { NeonAccordion, type NeonAccordionItem } from '../Accordion/NeonAccordion'
import { parseMarkdownStructure, type MarkdownSection } from '../../services/markdownParser'
import ScienceIcon from '@mui/icons-material/Science'

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

  // Parse markdown structure for accordion rendering
  const markdownStructure = useMemo(() => {
    if (!content) return null
    return parseMarkdownStructure(content)
  }, [content])

  // Generate nested accordion items from all sections
  const accordionItems = useMemo<NeonAccordionItem[]>(() => {
    if (!markdownStructure || !markdownStructure.sections.length) return []
    
    // Function to recursively create accordion items for nested sections
    const createAccordionItem = (section: MarkdownSection): NeonAccordionItem => {
      return {
        id: section.id,
        title: (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            {section.hasLogicContent && <ScienceIcon sx={{ color: '#00e676', fontSize: 18 }} />}
            <Typography 
              variant={section.level === 1 ? "h6" : section.level === 2 ? "subtitle1" : "subtitle2"} 
              sx={{ 
                flex: 1, 
                fontWeight: 600,
                color: section.level === 1 ? '#40c4ff' : section.level === 2 ? '#8ad7ff' : '#b3e5ff'
              }}
            >
              {section.title}
            </Typography>
            {(section.expressionCount > 0 || section.argumentCount > 0) && (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {section.expressionCount > 0 && (
                  <Chip 
                    size="small" 
                    label={`${section.expressionCount} expr`}
                    sx={{ 
                      backgroundColor: 'rgba(0,230,118,0.15)', 
                      color: '#00e676', 
                      fontSize: 10,
                      height: 18
                    }} 
                  />
                )}
                {section.argumentCount > 0 && (
                  <Chip 
                    size="small" 
                    label={`${section.argumentCount} args`}
                    sx={{ 
                      backgroundColor: 'rgba(255,193,7,0.15)', 
                      color: '#ffc107', 
                      fontSize: 10,
                      height: 18
                    }} 
                  />
                )}
              </Box>
            )}
          </Box>
        ),
        content: (
          <Box>
            {/* Render section content with markdown */}
            <ReactMarkdown
              remarkPlugins={[logicRemarkPlugin]}
              components={{
                // Skip the main heading since it's in the accordion title
                h1: () => null,
                h2: () => null,
                h3: () => null,
                h4: () => null,
                h5: () => null,
                h6: () => null,
                p: ({ children }) => <Typography variant="body2" sx={{ mb: 1.5, lineHeight: 1.6 }}>{children}</Typography>,
                ul: ({ children }) => <Box component="ul" sx={{ mb: 1.5, pl: 2, '& li': { mb: 0.5 } }}>{children}</Box>,
                ol: ({ children }) => <Box component="ol" sx={{ mb: 1.5, pl: 2, '& li': { mb: 0.5 } }}>{children}</Box>,
                blockquote: ({ children }) => (
                  <Box sx={{ 
                    borderLeft: '4px solid rgba(64,196,255,0.5)',
                    pl: 2,
                    py: 1,
                    mb: 1.5,
                    backgroundColor: 'rgba(64,196,255,0.05)',
                    borderRadius: '0 4px 4px 0',
                    fontStyle: 'italic'
                  }}>
                    {children}
                  </Box>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes('language-')
                  if (isBlock) {
                    return (
                      <Box sx={{ 
                        backgroundColor: 'rgba(0,0,0,0.4)', 
                        border: '1px solid rgba(64,196,255,0.3)',
                        borderRadius: 1,
                        p: 1.5,
                        mb: 1.5,
                        fontFamily: 'monospace',
                        fontSize: 13,
                        overflow: 'auto'
                      }}>
                        {children}
                      </Box>
                    )
                  }
                  return (
                    <Box component="code" sx={{ 
                      backgroundColor: 'rgba(64,196,255,0.15)', 
                      color: '#40c4ff',
                      px: 0.5,
                      py: 0.2,
                      borderRadius: 0.5,
                      fontSize: 13,
                      fontFamily: 'monospace'
                    }}>
                      {children}
                    </Box>
                  )
                }
              }}
            >
              {section.content}
            </ReactMarkdown>
            
            {/* Expression buttons for this section */}
            {markdownStructure.expressions
              .filter(expr => expr.sectionId === section.id)
              .map((expr, idx) => (
                <Box key={idx} sx={{ mt: 2, p: 1.5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 1, border: '1px solid rgba(64,196,255,0.2)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="caption" sx={{ color: '#40c4ff', fontWeight: 600 }}>Expression (Line {expr.line + 1}):</Typography>
                  </Box>
                  <pre style={{ 
                    margin: 0, 
                    fontSize: 13, 
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    padding: 12,
                    borderRadius: 6,
                    overflow: 'auto',
                    border: '1px solid rgba(64,196,255,0.1)'
                  }}>
                    {expr.expression}
                  </pre>
                  <button 
                    onClick={() => setCurrentExpression(expr.expression)}
                    style={{ 
                      marginTop: 8,
                      padding: '6px 12px', 
                      borderRadius: 6, 
                      border: '1px solid #40c4ff', 
                      backgroundColor: 'rgba(64,196,255,0.1)', 
                      color: '#40c4ff', 
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600
                    }}
                  >
                    Use Expression
                  </button>
                </Box>
              ))
            }
            
            {/* Render child sections as nested accordions */}
            {section.children.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <NeonAccordion items={section.children.map(createAccordionItem)} />
              </Box>
            )}
          </Box>
        )
      }
    }
    
    // Create accordion items from top-level sections
    return markdownStructure.sections.filter(section => section.level === 1).map(createAccordionItem)
  }, [markdownStructure, setCurrentExpression])

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
        
        {/* Document Stats */}
        {markdownStructure && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Typography variant="caption" sx={{ color: '#8ad7ff' }}>
              Document Overview:
            </Typography>
            <Chip 
              size="small" 
              label={`${markdownStructure.totalHeadings} sections`}
              sx={{ fontSize: 10, height: 18, backgroundColor: 'rgba(64,196,255,0.15)', color: '#40c4ff' }}
            />
            <Chip 
              size="small" 
              label={`${markdownStructure.expressions.length} expressions`}
              sx={{ fontSize: 10, height: 18, backgroundColor: 'rgba(0,230,118,0.15)', color: '#00e676' }}
            />
            <Chip 
              size="small" 
              label={`${markdownStructure.sections.filter(s => s.hasLogicContent).length} logic sections`}
              sx={{ fontSize: 10, height: 18, backgroundColor: 'rgba(255,193,7,0.15)', color: '#ffc107' }}
            />
          </Box>
        )}
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

      {/* Main Document Content as Accordions */}
      <div className="document-content">
        {markdownStructure && accordionItems.length > 0 ? (
          <Box sx={{ mt: 2 }}>
            <NeonAccordion items={accordionItems} />
          </Box>
        ) : (
          <div className="markdown-content">
            <React.Suspense fallback={<div>Loading renderer…</div>}>
              <PluginsRenderer content={content} activeExpression={currentExpression} />
            </React.Suspense>
          </div>
        )}
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
