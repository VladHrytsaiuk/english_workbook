import { dedupKey } from './dedup'
import { makeCloze } from './srs'
import { type ChatMessage, MISTAKE_CATEGORIES, type MistakeCategory, type TranslationProvider, type WritingCorrection, type WritingCriterion, type WritingEntry, type WritingEvaluation } from './types'

export const CRITERIA: WritingCriterion[] = ['content', 'style', 'vocabulary', 'grammar']

/** Names of the four criteria, per kind of exercise. */
export const CRITERION_LABEL: Record<WritingEntry['kind'], Record<WritingCriterion, { name: string; hint: string }>> = {
  essay: {
    content: { name: 'Task & ideas', hint: 'Did you cover the task, with enough detail?' },
    style: { name: 'Organisation & style', hint: 'Clear structure, linking words, suitable tone' },
    vocabulary: { name: 'Vocabulary', hint: 'Range and accuracy of words and phrases' },
    grammar: { name: 'Grammar', hint: 'Range and accuracy of structures' }
  },
  chat: {
    content: { name: 'Communication', hint: 'Did you reach the goals and keep the conversation going?' },
    style: { name: 'Tone & appropriateness', hint: 'Formal or informal as the situation needs' },
    vocabulary: { name: 'Vocabulary', hint: 'Range and accuracy of words and phrases' },
    grammar: { name: 'Grammar', hint: 'Range and accuracy of structures' }
  }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** The learner's own words in an entry: the essay, or all of their chat messages. */
export function learnerText(entry: Pick<WritingEntry, 'kind' | 'text' | 'messages'>): string {
  return entry.kind === 'essay' ? entry.text : entry.messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n')
}

/** Target words that appear in the text, in any grammatical form ("give up" is found in "gave up"). */
export function wordsUsed(text: string, words: string[]): Set<string> {
  const used = new Set<string>()
  for (const w of words) if (makeCloze(text, w)) used.add(w)
  return used
}

/** 0–100 from four 0–5 scores. Calculated here so that the arithmetic is always the same. */
export function overallScore(scores: Record<WritingCriterion, number>): number {
  const sum = CRITERIA.reduce((s, k) => s + scores[k], 0)
  return Math.round((sum / (CRITERIA.length * 5)) * 100)
}

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
type Json = Record<string, unknown>

const strings = (v: unknown, max: number): string[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .slice(0, max)

/**
 * Turns the AI's JSON into a trustworthy evaluation. The model can slip, so everything is checked:
 * scores are clamped to 0–5, a correction is kept only when its `original` really stands in the learner's text
 * (the exact spelling is taken from the text), the overall percentage is calculated here, and `used` for target words
 * is decided by the app, not by the model. Returns null when the scores are unusable.
 */
export function normalizeEvaluation(raw: Json, source: { learnerText: string; targetWords: string[]; provider: TranslationProvider; at: string }): WritingEvaluation | null {
  const scores = {} as Record<WritingCriterion, number>
  for (const k of CRITERIA) {
    const n = Number(raw[k])
    if (!Number.isFinite(n)) return null
    scores[k] = Math.max(0, Math.min(5, Math.round(n)))
  }
  const text = source.learnerText
  const lower = text.toLowerCase()

  const corrections: WritingCorrection[] = []
  const seen = new Set<string>()
  for (const c of Array.isArray(raw.corrections) ? (raw.corrections as Json[]) : []) {
    const original = typeof c.original === 'string' ? c.original.trim() : ''
    const corrected = typeof c.corrected === 'string' ? c.corrected.trim() : ''
    if (!original || !corrected || original === corrected) continue
    let exact = text.includes(original) ? original : ''
    if (!exact) {
      const at = lower.indexOf(original.toLowerCase())
      if (at >= 0) exact = text.slice(at, at + original.length)
    }
    if (!exact || seen.has(exact)) continue
    seen.add(exact)
    const category = MISTAKE_CATEGORIES.includes(c.category as MistakeCategory) ? (c.category as MistakeCategory) : 'grammar'
    corrections.push({ original: exact, corrected, explanation: typeof c.explanation === 'string' ? c.explanation.trim() : '', category })
    if (corrections.length >= 15) break
  }

  const used = wordsUsed(text, source.targetWords)
  const aiWords = Array.isArray(raw.targetWords) ? (raw.targetWords as Json[]) : []
  const targetWords = source.targetWords.map((word) => {
    const ai = aiWords.find((a) => typeof a.word === 'string' && dedupKey(a.word) === dedupKey(word))
    const isUsed = used.has(word)
    return { word, used: isUsed, correct: isUsed && ai?.correct !== false, note: isUsed && typeof ai?.note === 'string' ? ai.note.trim() : '' }
  })

  const cefr = typeof raw.cefr === 'string' && CEFR.includes(raw.cefr.toUpperCase()) ? raw.cefr.toUpperCase() : ''
  return {
    scores,
    overall: overallScore(scores),
    cefr,
    summary: typeof raw.summary === 'string' ? raw.summary.trim() : '',
    strengths: strings(raw.strengths, 6),
    improvements: strings(raw.improvements, 6),
    corrections,
    improved: typeof raw.improved === 'string' ? raw.improved.trim() : '',
    targetWords,
    provider: source.provider,
    evaluatedAt: source.at
  }
}

/** The text split into plain parts and parts that have a correction (first occurrence of each, no overlaps). */
export function segmentText(text: string, corrections: WritingCorrection[]): { text: string; correction?: number }[] {
  const ranges: { start: number; end: number; correction: number }[] = []
  corrections.forEach((c, i) => {
    let from = 0
    while (from <= text.length) {
      const at = text.indexOf(c.original, from)
      if (at < 0) return
      const end = at + c.original.length
      if (!ranges.some((r) => at < r.end && end > r.start)) {
        ranges.push({ start: at, end, correction: i })
        return
      }
      from = at + 1
    }
  })
  ranges.sort((a, b) => a.start - b.start)
  const out: { text: string; correction?: number }[] = []
  let pos = 0
  for (const r of ranges) {
    if (r.start > pos) out.push({ text: text.slice(pos, r.start) })
    out.push({ text: text.slice(r.start, r.end), correction: r.correction })
    pos = r.end
  }
  if (pos < text.length) out.push({ text: text.slice(pos) })
  return out
}

/** The conversation as plain text for the model (the last `limit` messages). */
export function chatTranscript(messages: ChatMessage[], limit = 24): string {
  return messages
    .slice(-limit)
    .map((m) => `${m.role === 'user' ? 'LEARNER' : 'YOU'}: ${m.content}`)
    .join('\n')
}

/** How often each kind of mistake was corrected in evaluated entries, most frequent first. */
export function mistakeStats(entries: WritingEntry[]): { category: MistakeCategory; count: number }[] {
  const counts = new Map<MistakeCategory, number>()
  for (const e of entries) for (const c of e.evaluation?.corrections ?? []) counts.set(c.category, (counts.get(c.category) ?? 0) + 1)
  return [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count)
}

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'writing'

/** A readable Markdown copy of an evaluated entry, saved into the workbook's `writing/` folder. */
export function entryToMarkdown(e: WritingEntry): string {
  const ev = e.evaluation
  const date = e.createdAt.slice(0, 10)
  const head = ['---', `title: ${JSON.stringify(e.title)}`, `date: ${date}`, `kind: ${e.kind}`, ...(ev ? [`score: ${ev.overall}`, ...(ev.cefr ? [`level: ${ev.cefr}`] : [])] : []), '---', '', `# ${e.title}`, '', e.prompt.trim(), '']
  const body =
    e.kind === 'essay'
      ? ['## My text', '', e.text.trim(), '']
      : ['## Conversation', '', ...e.messages.map((m) => `**${m.role === 'user' ? 'Me' : e.aiRole ?? 'Partner'}:** ${m.content}${m.tip ? `  \n*Tip: ${m.tip}*` : ''}\n`)]
  if (!ev) return [...head, ...body].join('\n')
  const labels = CRITERION_LABEL[e.kind]
  const feedback = [
    `## Feedback — ${ev.overall}%${ev.cefr ? ` · ${ev.cefr}` : ''}`,
    '',
    ...CRITERIA.map((k) => `- ${labels[k].name}: ${ev.scores[k]}/5`),
    '',
    ev.summary,
    '',
    ...(ev.strengths.length ? ['### Strengths', '', ...ev.strengths.map((s) => `- ${s}`), ''] : []),
    ...(ev.improvements.length ? ['### To improve', '', ...ev.improvements.map((s) => `- ${s}`), ''] : []),
    ...(ev.corrections.length ? ['### Corrections', '', ...ev.corrections.map((c) => `- ~~${c.original}~~ → **${c.corrected}** (${c.category}) — ${c.explanation}`), ''] : []),
    ...(ev.improved ? ['### Improved version', '', ev.improved, ''] : [])
  ]
  return [...head, ...body, ...feedback].join('\n')
}
