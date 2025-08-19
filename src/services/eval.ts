import type { AstNodeRec } from './logic'

function evalNode(node: AstNodeRec, env: Record<string, boolean>): boolean {
  const label = node.label
  const children = node.children || []
  // variable/predicate without children: treat label as variable name (first token)
  if (!children.length) {
    const name = label.trim()
    return !!env[name]
  }
  switch (label) {
    case '¬':
      return !evalNode(children[0], env)
    case '∧':
      return children.every(c => evalNode(c, env))
    case '∨':
      return children.some(c => evalNode(c, env))
    case '⊻': {
      const a = evalNode(children[0], env)
      const b = evalNode(children[1], env)
      return (!!a) !== (!!b)
    }
    case '→': {
      const a = evalNode(children[0], env)
      const b = evalNode(children[1], env)
      return (!a) || b
    }
    case '↔': {
      const a = evalNode(children[0], env)
      const b = evalNode(children[1], env)
      return a === b
    }
    default:
      // predicate/function: evaluate children and AND them by default for truth table context
      return children.every(c => evalNode(c, env))
  }
}

export function evalAst(ast: AstNodeRec, env: Record<string, boolean>): boolean {
  return evalNode(ast, env)
}
