import React from 'react'
import type { AstNodeRec } from '../../services/logic'
import { evalAst } from '../../services/eval'

function collectVars(node: AstNodeRec, acc: Set<string>) {
  const kids = node.children || []
  if (!kids.length) {
    const name = node.label.trim()
    if (/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) acc.add(name)
    return
  }
  kids.forEach(k => collectVars(k, acc))
}

export const TruthTable: React.FC<{ ast: AstNodeRec }> = ({ ast }) => {
  const vars = React.useMemo(() => {
    const s = new Set<string>()
    collectVars(ast, s)
    return Array.from(s).sort()
  }, [ast])
  const rows = React.useMemo(() => (1 << vars.length), [vars])
  const data = React.useMemo(() => {
    const out: Array<{ env: Record<string, boolean>; val: boolean }> = []
    for (let i = 0; i < rows; i++) {
      const env: Record<string, boolean> = {}
      vars.forEach((v, idx) => { env[v] = !!((i >> (vars.length - idx - 1)) & 1) })
      out.push({ env, val: evalAst(ast, env) })
    }
    return out
  }, [ast, vars, rows])
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ minWidth: 300, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {vars.map(v => <th key={v} style={{ border: '1px solid rgba(64,196,255,0.25)', padding: '4px 8px' }}>{v}</th>)}
            <th style={{ border: '1px solid rgba(64,196,255,0.25)', padding: '4px 8px' }}>Expr</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} style={{ background: row.val ? 'rgba(0,200,83,0.12)' : 'rgba(244,67,54,0.08)' }}>
              {vars.map(v => <td key={v} style={{ border: '1px solid rgba(64,196,255,0.25)', padding: '4px 8px', textAlign: 'center' }}>{row.env[v] ? 'T' : 'F'}</td>)}
              <td style={{ border: '1px solid rgba(64,196,255,0.25)', padding: '4px 8px', textAlign: 'center' }}>{row.val ? 'T' : 'F'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TruthTable
