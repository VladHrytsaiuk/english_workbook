import type { CheckResult, SimpleQuestion, TfValue, UserAnswer } from './types'

/**
 * Normalises a typed answer for comparison:
 * - Unicode NFC, lower case
 * - curly / typographic apostrophes and quotes → straight ones
 * - en/em dashes → hyphen
 * - trim, collapse internal whitespace, drop spaces before punctuation
 * - ignore trailing sentence punctuation (. ! ? …)
 */
export function normalizeAnswer(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’‚‛ʼʹ`´′]/g, "'")
    .replace(/[“”„‟«»″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
    .replace(/[.!?…]+$/u, '')
    .trim()
}

/** Splits `a | b | c` into trimmed, non-empty alternatives. */
export function splitAlternatives(raw: string): string[] {
  return raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** True if `input` matches any of the accepted answers after normalisation. */
export function matchesAny(input: string, accepted: string[]): boolean {
  const n = normalizeAnswer(input)
  if (!n) return false
  return accepted.some((a) => normalizeAnswer(a) === n)
}

export function normalizeTf(raw: unknown): TfValue | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
  if (['true', 't', 'yes', 'y'].includes(s)) return 'true'
  if (['false', 'f', 'no', 'n'].includes(s)) return 'false'
  if (['not given', 'ng', 'notgiven', 'not stated', 'ns'].includes(s)) return 'not given'
  return null
}


/** Edit distance where swapping two neighbouring letters counts as one edit (optimal string alignment). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

export type TypedVerdict = 'correct' | 'typo' | 'wrong'

/**
 * Compares a typed word/phrase with the card text. Case, spacing, apostrophes and final punctuation
 * are ignored, and a leading "to " on verbs is optional. One slip (a wrong, missing or swapped letter) counts as a
 * "typo" for words of 5+ letters, two slips for phrases over 10 letters; short words must be exact (take ≠ make).
 */
export function checkTyped(input: string, target: string, otherForms: string[] = []): TypedVerdict {
  const strip = (s: string): string => normalizeAnswer(s).replace(/^to\s+/, '')
  const a = strip(input)
  const b = strip(target)
  if (!a) return 'wrong'
  if (a === b) return 'correct'
  // A different real form of the word ("give up" for "gave up") is a grammar mistake, not a typo.
  if (otherForms.some((f) => strip(f) === a)) return 'wrong'
  const allowed = b.length > 10 ? 2 : b.length >= 5 ? 1 : 0
  return editDistance(a, b) <= allowed ? 'typo' : 'wrong'
}

export function checkAnswer(q: SimpleQuestion, answer: UserAnswer, opts: { forgiveTypos?: boolean } = {}): CheckResult {
  switch (q.type) {
    case 'choice':
      return { correct: typeof answer === 'string' && answer === q.answer }
    case 'gap':
    case 'transform':
    case 'error': {
      if (typeof answer !== 'string') return { correct: false }
      if (matchesAny(answer, q.answers)) return { correct: true }
      // Vocabulary spelling questions only: one slip in a word of 5+ letters still counts (grammar stays exact: has ≠ had).
      if (opts.forgiveTypos && q.typoTolerant) {
        const verdicts = q.answers.map((a) => checkTyped(answer, a, q.otherForms))
        if (verdicts.includes('correct')) return { correct: true }
        if (verdicts.includes('typo')) return { correct: true, typo: true }
      }
      return { correct: false }
    }
    case 'tf':
      return { correct: typeof answer === 'string' && normalizeTf(answer) === q.answer }
    case 'order': {
      if (!Array.isArray(answer)) return { correct: false }
      const sentence = answer.map((i) => q.chunks[i] ?? '').join(' ')
      return { correct: answer.length === q.chunks.length && matchesAny(sentence, q.answers) }
    }
    case 'match': {
      if (!Array.isArray(answer)) return { correct: false, partial: { right: 0, total: q.pairs.length } }
      // Compare by the right-hand *text*, so duplicate right values are handled gracefully.
      let right = 0
      q.pairs.forEach((p, i) => {
        const chosen = answer[i]
        if (chosen !== undefined && chosen >= 0 && q.pairs[chosen]?.right === p.right) right++
      })
      return { correct: right === q.pairs.length, partial: { right, total: q.pairs.length } }
    }
  }
}

/** Human-readable correct answer (for results and the mistakes list). */
export function formatCorrectAnswer(q: SimpleQuestion): string {
  switch (q.type) {
    case 'choice':
      return q.answer
    case 'gap':
    case 'transform':
    case 'error':
    case 'order':
      return q.answers.join('  |  ')
    case 'tf':
      return tfLabel(q.answer)
    case 'match':
      return q.pairs.map((p) => `${p.left} → ${p.right}`).join('; ')
  }
}

/** Human-readable version of what the learner answered. */
export function formatUserAnswer(q: SimpleQuestion, answer: UserAnswer | undefined): string {
  if (answer === undefined) return '—'
  switch (q.type) {
    case 'order':
      return Array.isArray(answer) ? answer.map((i) => q.chunks[i]).join(' ') : String(answer)
    case 'match':
      return Array.isArray(answer)
        ? q.pairs.map((p, i) => `${p.left} → ${answer[i] >= 0 ? q.pairs[answer[i]]?.right : '?'}`).join('; ')
        : String(answer)
    case 'tf': {
      const v = normalizeTf(answer)
      return v ? tfLabel(v) : String(answer)
    }
    default:
      return typeof answer === 'string' ? answer || '—' : String(answer)
  }
}

export function tfLabel(v: TfValue): string {
  return v === 'true' ? 'True' : v === 'false' ? 'False' : 'Not Given'
}
