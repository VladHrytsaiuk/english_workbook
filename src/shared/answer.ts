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

export function checkAnswer(q: SimpleQuestion, answer: UserAnswer): CheckResult {
  switch (q.type) {
    case 'choice':
      return { correct: typeof answer === 'string' && answer === q.answer }
    case 'gap':
    case 'transform':
    case 'error':
      return { correct: typeof answer === 'string' && matchesAny(answer, q.answers) }
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
