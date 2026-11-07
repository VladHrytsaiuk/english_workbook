import { describe, expect, it } from 'vitest'
import { checkAnswer } from '@shared/answer'
import { newSrs, reviewCard } from '@shared/srs'
import { parseTest } from '@shared/testParser'
import { ALL_KINDS_FOR_TEST, buildWordTest, filterBySource, wordTestPrompt, type WordKind } from '@shared/wordTest'
import type { UserAnswer, VocabEntry } from '@shared/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const now = new Date('2026-11-07T10:00:00Z')

function word(i: number, text: string, translation: string, extra: Partial<VocabEntry> = {}): VocabEntry {
  return {
    id: `id-${i}-${text}`,
    text,
    translation,
    source: { kind: 'note', title: 'n' },
    createdAt: new Date(now.getTime() - i * 86_400_000).toISOString(),
    tags: [],
    srs: newSrs(now),
    ...extra
  }
}

const WORDS: VocabEntry[] = [
  word(1, 'deadline', 'кінцевий термін', { pos: 'noun', context: 'We have to meet the deadline by Friday.' }),
  word(2, 'to give up', 'здаватися', { pos: 'phrasal verb', context: "Don't give up on your dreams." }),
  word(3, 'reliable', 'надійний', { pos: 'adjective', context: 'She is a very reliable colleague.' }),
  word(4, 'commute', 'дорога на роботу', { pos: 'noun', context: 'My daily commute takes an hour.', examples: ['I commute by train every day.'] }),
  word(5, 'eventually', 'зрештою', { pos: 'adverb' }),
  word(6, 'whereas', 'тоді як', { pos: 'conjunction', context: 'I like tea, whereas my sister prefers coffee.' }),
  word(7, 'sustainable', 'сталий', { pos: 'adjective', context: 'We need a more sustainable way of living.' }),
  word(8, 'appointment', 'запис, зустріч', { pos: 'noun', context: 'I have a dentist appointment at 3 pm.' }),
  word(9, 'look forward to', 'з нетерпінням чекати', { pos: 'phrasal verb', context: 'I really look forward to seeing you.' }),
  word(10, 'although', 'хоча', { pos: 'conjunction', context: 'Although it was raining, we went for a walk.' })
]

const ALL: WordKind[] = ['translate', 'reverse', 'typing', 'cloze', 'order', 'match']
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** The right answer for any question, as the learner would give it. */
function solve(q: ReturnType<typeof buildWordTest>[number]): UserAnswer {
  switch (q.type) {
    case 'choice':
      return q.answer
    case 'gap':
    case 'transform':
    case 'error':
      return q.answers[0]
    case 'order':
      return q.chunks.map((_, i) => i)
    case 'match':
      return q.pairs.map((_, i) => i)
    case 'tf':
      return q.answer
  }
}

describe('buildWordTest', () => {
  it('builds one question per word and every question is answerable', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const items = buildWordTest(WORDS, WORDS, { count: 10, kinds: ALL, rand: seeded(seed) })
      const words = items.filter((i) => i.type !== 'match')
      expect(words).toHaveLength(10)
      for (const q of items) expect(checkAnswer(q, solve(q)).correct, `${q.id} ${q.type}: ${q.prompt}`).toBe(true)
    }
  })

  it('never asks about the same word twice, and keys are unique and stable', () => {
    const items = buildWordTest(WORDS, WORDS, { count: 10, kinds: ALL, rand: seeded(3) })
    const keys = items.map((i) => i.key)
    expect(new Set(keys).size).toBe(keys.length)
    const wordKeys = items.filter((i) => i.type !== 'match').map((i) => i.key.replace(/:.*/, ''))
    expect(new Set(wordKeys).size).toBe(wordKeys.length)
    expect(keys.every((k) => k.startsWith('words#'))).toBe(true)
    expect(items.map((i) => i.id)).toEqual(items.map((_, n) => `W${n + 1}`))
  })

  it('choice options are distinct and contain the right answer exactly once', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const q of buildWordTest(WORDS, WORDS, { count: 10, kinds: ['translate', 'reverse'], rand: seeded(seed) })) {
        if (q.type !== 'choice') throw new Error('expected choice')
        expect(q.options).toHaveLength(4)
        expect(new Set(q.options.map((o) => o.toLowerCase())).size).toBe(4)
        expect(q.options.filter((o) => o === q.answer)).toHaveLength(1)
      }
    }
  })

  it('respects the chosen kinds', () => {
    const only = (kinds: WordKind[]) => new Set(buildWordTest(WORDS, WORDS, { count: 10, kinds, rand: seeded(5) }).map((i) => i.type))
    expect(only(['translate'])).toEqual(new Set(['choice']))
    expect(only(['typing'])).toEqual(new Set(['gap']))
  })

  it('fill-the-gap blanks the word in the learner\'s own sentence and accepts the form used there', () => {
    const w = word(1, 'renovated', 'відремонтований', { context: 'The museum was Renovated last year.' })
    const [q] = buildWordTest([w], WORDS, { count: 1, kinds: ['cloze'] })
    if (q.type !== 'gap') throw new Error('gap')
    expect(q.prompt.startsWith('The museum was ___ last year.')).toBe(true)
    expect(checkAnswer(q, 'renovated').correct).toBe(true)
    expect(checkAnswer(q, 'Renovated').correct).toBe(true)
    expect(checkAnswer(q, 'painted').correct).toBe(false)
  })

  it('typing accepts a verb with or without "to"', () => {
    const [q] = buildWordTest([WORDS[1]], WORDS, { count: 1, kinds: ['typing'] })
    if (q.type !== 'gap') throw new Error('gap')
    expect(checkAnswer(q, 'give up').correct).toBe(true)
    expect(checkAnswer(q, 'to give up').correct).toBe(true)
  })

  it('skips kinds that cannot be built (no sentence → no gap) and falls back to the others', () => {
    const noSentence = [word(1, 'alpha', 'альфа'), word(2, 'beta', 'бета'), word(3, 'gamma', 'гама'), word(4, 'delta', 'дельта')]
    const items = buildWordTest(noSentence, noSentence, { count: 4, kinds: ['cloze', 'order'], rand: seeded(1) })
    expect(items).toHaveLength(0) // only unbuildable kinds were requested
    const mixed = buildWordTest(noSentence, noSentence, { count: 4, kinds: ['cloze', 'typing'], rand: seeded(1) })
    expect(mixed).toHaveLength(4)
    expect(mixed.every((q) => q.type === 'gap' && !q.prompt.includes('___'))).toBe(true)
  })

  it('does not build choice questions without enough distinct words for distractors', () => {
    const few = WORDS.slice(0, 3)
    expect(buildWordTest(few, few, { count: 3, kinds: ['translate', 'reverse'] })).toHaveLength(0)
    expect(buildWordTest(few, few, { count: 3, kinds: ['translate', 'typing'], rand: seeded(2) }).every((q) => q.type === 'gap')).toBe(true)
  })

  it('adds one matching round per 8 words, with unique pairs', () => {
    const items = buildWordTest(WORDS, WORDS, { count: 10, kinds: ['typing', 'match'], rand: seeded(9) })
    const matches = items.filter((i) => i.type === 'match')
    expect(matches).toHaveLength(1)
    const m = matches[0]
    if (m.type !== 'match') throw new Error('match')
    expect(m.pairs.length).toBeGreaterThanOrEqual(3)
    expect(new Set(m.pairs.map((p) => p.left)).size).toBe(m.pairs.length)
    expect(buildWordTest(WORDS.slice(0, 7), WORDS, { count: 7, kinds: ['typing', 'match'] }).some((i) => i.type === 'match')).toBe(false)
  })

  it('prefers difficult words when there are more candidates than questions', () => {
    let s = newSrs(now)
    for (let i = 0; i < 3; i++) {
      s = reviewCard(s, 4, new Date(s.due), 0.9)
      s = reviewCard(s, 1, new Date(s.due), 0.9)
    }
    const hard = { ...WORDS[0], srs: s }
    const pool = [hard, ...WORDS.slice(1)]
    let hits = 0
    for (let seed = 1; seed <= 60; seed++) {
      const items = buildWordTest(pool, pool, { count: 2, kinds: ['typing'], rand: seeded(seed) })
      if (items.some((i) => i.key.startsWith(`words#${hard.id}`))) hits++
    }
    expect(hits).toBeGreaterThan(30) // a plain 2-of-10 sample would give ~12
  })

  it('groups results by topic, then deck', () => {
    const w = { ...WORDS[0], deckId: 'd1' }
    const [a] = buildWordTest([w], WORDS, { count: 1, kinds: ['typing'], deckName: (id) => (id === 'd1' ? 'Work' : undefined) })
    expect(a.topics).toEqual(['Vocabulary · Work'])
    const [b] = buildWordTest([{ ...w, topic: 'Office' }], WORDS, { count: 1, kinds: ['typing'], deckName: () => 'Work' })
    expect(b.topics).toEqual(['Vocabulary · Office'])
  })

  it('ignores suspended words and words without a translation', () => {
    const list = [{ ...WORDS[0], suspended: true }, { ...WORDS[1], translation: '' }, WORDS[2]]
    const items = buildWordTest(list, list, { count: 5, kinds: ['typing'] })
    expect(items).toHaveLength(1)
  })

  it('ALL_KINDS_FOR_TEST lists every kind', () => {
    expect([...ALL_KINDS_FOR_TEST].sort()).toEqual([...ALL].sort())
  })
})

describe('filterBySource', () => {
  const list = [
    word(1, 'new-today', 'a'),
    word(20, 'old', 'b'),
    word(2, 'mastered', 'c', { srs: { ...newSrs(now), state: 2, stability: 40, reps: 8 } }),
    word(3, 'tricky', 'd', { srs: { ...newSrs(now), state: 3, lapses: 3, reps: 5 } }),
    word(4, 'suspended', 'e', { suspended: true }),
    word(5, 'untranslated', '')
  ]
  it('week', () => expect(filterBySource(list, 'week', now).map((e) => e.text)).toEqual(['new-today', 'mastered', 'tricky']))
  it('studying excludes mastered', () => expect(filterBySource(list, 'studying', now).map((e) => e.text)).toEqual(['new-today', 'old', 'tricky']))
  it('difficult', () => expect(filterBySource(list, 'difficult', now).map((e) => e.text)).toEqual(['tricky']))
  it('all skips suspended and untranslated words', () => expect(filterBySource(list, 'all', now)).toHaveLength(4))
})

describe('wordTestPrompt', () => {
  const spec = readFileSync(resolve(__dirname, '../docs/TEST_FORMAT.md'), 'utf8')
  const p = wordTestPrompt(WORDS.slice(0, 3), spec, now)
  it('lists the words with translations, parts of speech and context', () => {
    expect(p).toContain('1. deadline — кінцевий термін [noun] — seen in: “We have to meet the deadline by Friday.”')
    expect(p).toContain('3. reliable — надійний [adjective]')
    expect(p).toContain('ONLY these 3 words')
    expect(p).toContain('Vocabulary — 2026-11-07')
  })
  it('includes the whole format spec, so any chat can write a valid file', () => {
    expect(p).toContain('===== TEST FORMAT SPEC =====')
    expect(p).toContain('### 3.8 `reading`')
    expect(p.length).toBeGreaterThan(spec.length)
  })
})

describe('the format a chat is asked to produce stays valid', () => {
  it('a minimal vocabulary test written in the requested style parses', () => {
    const md = `---\ntitle: Vocabulary — 2026-11-07\ntopics: [Vocabulary]\n---\n\n## Q1\ntype: choice\ntopic: Vocabulary\nq: The ___ is on Friday.\noptions: [deadline, commute, appointment, whereas]\nanswer: deadline\nexplain: A deadline is the last moment to finish something (кінцевий термін).\n\n## Q2\ntype: match\ntopic: Vocabulary\nq: Match the words.\npairs:\n  - deadline: кінцевий термін\n  - reliable: надійний\nexplain: Basic pairs.\n`
    expect(parseTest(md, 'v.md').issues).toEqual([])
  })
})
