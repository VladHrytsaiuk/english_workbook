import { describe, expect, it } from 'vitest'
import { CHAT_SCENARIOS } from '@shared/chatScenarios'
import { chatTranscript, countWords, entryToMarkdown, learnerText, mistakeStats, normalizeEvaluation, overallScore, segmentText, slugify, wordsUsed } from '@shared/writing'
import { WRITING_TASKS, monthKey, taskForMonth } from '@shared/writingTasks'
import type { WritingEntry } from '@shared/types'

const at = '2026-11-08T10:00:00.000Z'
const text = 'I am agree with this idea. Yesterday I go to the shop and buyed some bread. We were giving up too early.'
const base = (over: Record<string, unknown> = {}) => ({
  content: 4,
  style: 3,
  vocabulary: 4,
  grammar: 2,
  cefr: 'b1',
  summary: 'Good effort.',
  strengths: ['Clear ideas'],
  improvements: ['Past tenses'],
  corrections: [{ original: 'I am agree', corrected: 'I agree', explanation: 'agree is a verb', category: 'grammar' }],
  improved: 'I agree with this idea.',
  targetWords: [],
  ...over
})
const src = { learnerText: text, targetWords: [] as string[], provider: 'gemini' as const, at }

describe('content banks', () => {
  it('writing tasks are well formed and unique', () => {
    expect(WRITING_TASKS.length).toBeGreaterThanOrEqual(20)
    expect(new Set(WRITING_TASKS.map((t) => t.id)).size).toBe(WRITING_TASKS.length)
    for (const t of WRITING_TASKS) {
      expect(t.title.length, t.id).toBeGreaterThan(3)
      expect(t.prompt.length, t.id).toBeGreaterThan(60)
      expect(t.minWords, t.id).toBeGreaterThanOrEqual(80)
      expect(t.maxWords, t.id).toBeGreaterThan(t.minWords)
    }
  })
  it('chat scenarios are well formed and unique', () => {
    expect(new Set(CHAT_SCENARIOS.map((s) => s.id)).size).toBe(CHAT_SCENARIOS.length)
    for (const s of CHAT_SCENARIOS) {
      expect(s.goals.length, s.id).toBeGreaterThanOrEqual(2)
      expect(s.aiRole.length, s.id).toBeGreaterThan(5)
      expect(['formal', 'informal']).toContain(s.register)
    }
  })
  it('the task of the month is stable within a month and moves on in the next one', () => {
    expect(taskForMonth('2026-11').id).toBe(taskForMonth('2026-11').id)
    expect(taskForMonth('2026-11').id).not.toBe(taskForMonth('2026-12').id)
    expect(taskForMonth('2026-11', 1).id).not.toBe(taskForMonth('2026-11').id)
    expect(taskForMonth('2026-11', -3)).toBeTruthy()
    expect(monthKey(new Date('2026-11-08T10:00:00'))).toBe('2026-11')
  })
})

describe('counting and target words', () => {
  it('counts words', () => {
    expect(countWords('  one two\nthree  ')).toBe(3)
    expect(countWords('')).toBe(0)
  })
  it('finds target words in any grammatical form', () => {
    const used = wordsUsed(text, ['give up', 'deadline', 'to go'])
    expect([...used].sort()).toEqual(['give up', 'to go'])
  })
  it('takes the learner\'s own words only', () => {
    const messages = [
      { role: 'assistant' as const, content: 'Hi!', at },
      { role: 'user' as const, content: 'Hello.', at },
      { role: 'user' as const, content: 'I am fine.', at }
    ]
    expect(learnerText({ kind: 'chat', text: '', messages })).toBe('Hello.\nI am fine.')
    expect(learnerText({ kind: 'essay', text: 'My essay', messages: [] })).toBe('My essay')
  })
})

describe('overallScore', () => {
  it('is the average of the four 0–5 scores as a percentage', () => {
    expect(overallScore({ content: 5, style: 5, vocabulary: 5, grammar: 5 })).toBe(100)
    expect(overallScore({ content: 0, style: 0, vocabulary: 0, grammar: 0 })).toBe(0)
    expect(overallScore({ content: 4, style: 3, vocabulary: 4, grammar: 2 })).toBe(65)
  })
})

describe('normalizeEvaluation (the model is not trusted)', () => {
  it('builds an evaluation with the overall score calculated by the app', () => {
    const e = normalizeEvaluation(base({ overall: 99 }), src)
    expect(e?.overall).toBe(65)
    expect(e?.cefr).toBe('B1')
    expect(e?.scores).toEqual({ content: 4, style: 3, vocabulary: 4, grammar: 2 })
    expect(e?.provider).toBe('gemini')
  })
  it('clamps scores and rejects unusable ones', () => {
    expect(normalizeEvaluation(base({ content: 9, grammar: -2, style: 3.6 }), src)?.scores).toMatchObject({ content: 5, grammar: 0, style: 4 })
    expect(normalizeEvaluation(base({ content: 'great' }), src)).toBeNull()
    expect(normalizeEvaluation({}, src)).toBeNull()
  })
  it('drops corrections that are not in the learner\'s text and fixes the spelling of the quote', () => {
    const e = normalizeEvaluation(
      base({
        corrections: [
          { original: 'I am agree', corrected: 'I agree', explanation: 'x', category: 'grammar' },
          { original: 'i go to the shop', corrected: 'I went to the shop', explanation: 'tense', category: 'tense' }, // different capitals in the quote
          { original: 'She does not like it', corrected: "She doesn't like it", explanation: 'invented', category: 'grammar' },
          { original: 'buyed', corrected: 'buyed', explanation: 'same', category: 'grammar' },
          { original: 'buyed some bread', corrected: 'bought some bread', explanation: 'irregular verb', category: 'nonsense' }
        ]
      }),
      src
    )
    expect(e?.corrections.map((c) => c.original)).toEqual(['I am agree', 'I go to the shop', 'buyed some bread'])
    expect(e?.corrections[2].category).toBe('grammar') // unknown categories fall back
  })
  it('removes duplicate corrections and limits their number', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ original: 'I am agree', corrected: `v${i}`, explanation: '', category: 'grammar' }))
    expect(normalizeEvaluation(base({ corrections: many }), src)?.corrections).toHaveLength(1)
  })
  it('decides "used" for target words itself', () => {
    const e = normalizeEvaluation(
      base({ targetWords: [{ word: 'give up', used: false, correct: true, note: 'nice' }, { word: 'deadline', used: true, correct: true, note: 'claimed' }] }),
      { ...src, targetWords: ['give up', 'deadline'] }
    )
    expect(e?.targetWords).toEqual([
      { word: 'give up', used: true, correct: true, note: 'nice' },
      { word: 'deadline', used: false, correct: false, note: '' }
    ])
  })
})

describe('segmentText', () => {
  it('splits the text around the corrections', () => {
    const corrections = [
      { original: 'buyed some bread', corrected: 'bought some bread', explanation: '', category: 'grammar' as const },
      { original: 'I am agree', corrected: 'I agree', explanation: '', category: 'grammar' as const }
    ]
    const parts = segmentText(text, corrections)
    expect(parts.map((p) => p.text).join('')).toBe(text)
    expect(parts.filter((p) => p.correction !== undefined).map((p) => [p.text, p.correction])).toEqual([
      ['I am agree', 1],
      ['buyed some bread', 0]
    ])
  })
  it('does not highlight overlapping corrections twice', () => {
    const c = (original: string) => ({ original, corrected: 'x', explanation: '', category: 'grammar' as const })
    const parts = segmentText('go to the shop', [c('go to'), c('to the shop')])
    expect(parts.map((p) => p.text).join('')).toBe('go to the shop')
    expect(parts.filter((p) => p.correction !== undefined)).toHaveLength(1)
  })
  it('returns the plain text when there is nothing to mark', () => {
    expect(segmentText('Hello', [])).toEqual([{ text: 'Hello' }])
  })
})

describe('chatTranscript and statistics', () => {
  it('labels the speakers and keeps the latest messages', () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? ('user' as const) : ('assistant' as const), content: `m${i}`, at }))
    const lines = chatTranscript(messages, 4).split('\n')
    expect(lines).toEqual(['YOU: m26', 'LEARNER: m27', 'YOU: m28', 'LEARNER: m29'])
  })
  it('counts corrected mistakes by category', () => {
    const entry = (cats: string[]): WritingEntry =>
      ({ evaluation: { corrections: cats.map((category) => ({ original: 'a', corrected: 'b', explanation: '', category })) } }) as unknown as WritingEntry
    expect(mistakeStats([entry(['article', 'tense']), entry(['article', 'article', 'spelling']), {} as WritingEntry])).toEqual([
      { category: 'article', count: 3 },
      { category: 'tense', count: 1 },
      { category: 'spelling', count: 1 }
    ])
  })
})

describe('markdown copy and slug', () => {
  const entry: WritingEntry = {
    id: '1',
    kind: 'essay',
    title: 'Working from home',
    prompt: 'Write an essay.',
    month: '2026-11',
    createdAt: at,
    updatedAt: at,
    status: 'evaluated',
    targetWords: [],
    text: 'My text.',
    messages: [],
    evaluation: normalizeEvaluation(base(), { ...src, learnerText: 'I am agree with this idea.' }) ?? undefined
  }
  it('contains the text, the scores and the corrections', () => {
    const md = entryToMarkdown(entry)
    expect(md).toContain('title: "Working from home"')
    expect(md).toContain('score: 65')
    expect(md).toContain('## My text')
    expect(md).toContain('~~I am agree~~ → **I agree** (grammar)')
  })
  it('makes safe file names', () => {
    expect(slugify('A very Long: title — with symbols!!')).toBe('a-very-long-title-with-symbols')
    expect(slugify('Лист')).toBe('writing')
  })
})
