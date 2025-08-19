export type VennRuleKind = 'all' | 'some' | 'no' | null

export type VennParse = {
  kind: VennRuleKind
  left?: string
  right?: string
}

// Very simple parser for phrases like:
// - All A are B
// - Some A are B
// - No A are B
export function parseVennRule(text: string): VennParse {
  const t = (text || '').trim()
  const mAll = /^all\s+([A-Za-z]+)\s+(are|⊂|subset\s+of)\s+([A-Za-z]+)/i.exec(t)
  if (mAll) return { kind: 'all', left: mAll[1], right: mAll[3] }
  const mSome = /^some\s+([A-Za-z]+)\s+(are|∩)\s+([A-Za-z]+)/i.exec(t)
  if (mSome) return { kind: 'some', left: mSome[1], right: mSome[3] }
  const mNo = /^no\s+([A-Za-z]+)\s+(are|∩)\s+([A-Za-z]+)/i.exec(t)
  if (mNo) return { kind: 'no', left: mNo[1], right: mNo[3] }
  return { kind: null }
}

export type VennShading = {
  intersection: boolean
  leftOnly: boolean
  rightOnly: boolean
  disjoint: boolean
  note?: string
}

// Provide simple shading hints for UI; real validation can be expanded later
export function computeShading(kind: VennRuleKind): VennShading {
  if (kind === 'all') {
    return { intersection: false, leftOnly: false, rightOnly: true, disjoint: false, note: 'All A ⊆ B' }
  }
  if (kind === 'some') {
    return { intersection: true, leftOnly: false, rightOnly: false, disjoint: false, note: 'Some A ∩ B ≠ ∅' }
  }
  if (kind === 'no') {
    return { intersection: false, leftOnly: false, rightOnly: false, disjoint: true, note: 'A ∩ B = ∅' }
  }
  return { intersection: false, leftOnly: false, rightOnly: false, disjoint: false }
}
