import { describe, expect, it } from 'vitest'
import { checkAnswer, matchesAny, normalizeAnswer, normalizeTf, splitAlternatives } from '@shared/answer'
import type { MatchQuestion, OrderQuestion, TextQuestion } from '@shared/types'

const base = { id: 'Q', prompt: 'q', topics: [], line: 1 }

describe('normalizeAnswer', () => {
  it('is case-insensitive and trims / collapses whitespace', () => {
    expect(normalizeAnswer('  Had   ALREADY\tstarted ')).toBe('had already started')
  })
  it('normalises curly apostrophes and quotes', () => {
    expect(normalizeAnswer('She’s been')).toBe(normalizeAnswer("She's been"))
    expect(normalizeAnswer('‘ok’ “x”')).toBe(`'ok' "x"`)
  })
  it('ignores trailing sentence punctuation and spaces before punctuation', () => {
    expect(normalizeAnswer('A bridge is being built.')).toBe('a bridge is being built')
    expect(normalizeAnswer('Really , yes !')).toBe('really, yes')
  })
})

describe('splitAlternatives / matchesAny', () => {
  it('splits on |', () => {
    expect(splitAlternatives('had already started | had started |')).toEqual(['had already started', 'had started'])
  })
  it('accepts any alternative', () => {
    expect(matchesAny('HAD STARTED', ['had already started', 'had started'])).toBe(true)
    expect(matchesAny('started', ['had already started', 'had started'])).toBe(false)
  })
  it('rejects empty input', () => {
    expect(matchesAny('   ', ['x'])).toBe(false)
  })
})

describe('normalizeTf', () => {
  it.each([
    ['true', 'true'],
    ['T', 'true'],
    ['False', 'false'],
    ['not given', 'not given'],
    ['NG', 'not given'],
    ['not_given', 'not given'],
    ['maybe', null]
  ])('%s → %s', (input, out) => expect(normalizeTf(input)).toBe(out))
})

describe('checkAnswer', () => {
  it('gap with alternatives and apostrophes', () => {
    const q: TextQuestion = { ...base, type: 'gap', answers: ["is sleeping", "'s sleeping"] }
    expect(checkAnswer(q, '’s sleeping').correct).toBe(true)
    expect(checkAnswer(q, 'sleeps').correct).toBe(false)
  })
  it('order compares the assembled sentence', () => {
    const q: OrderQuestion = { ...base, type: 'order', chunks: ['Have', 'you', 'ever', 'been', 'to London?'], answers: ['Have you ever been to London?'] }
    expect(checkAnswer(q, [0, 1, 2, 3, 4]).correct).toBe(true)
    expect(checkAnswer(q, [1, 0, 2, 3, 4]).correct).toBe(false)
    expect(checkAnswer(q, [0, 1, 2]).correct).toBe(false)
  })
  it('match reports partial results', () => {
    const q: MatchQuestion = { ...base, type: 'match', pairs: [{ left: 'a', right: '1' }, { left: 'b', right: '2' }, { left: 'c', right: '3' }] }
    expect(checkAnswer(q, [0, 1, 2])).toEqual({ correct: true, partial: { right: 3, total: 3 } })
    expect(checkAnswer(q, [1, 0, 2])).toEqual({ correct: false, partial: { right: 1, total: 3 } })
  })
  it('match treats duplicate right sides as interchangeable', () => {
    const q: MatchQuestion = { ...base, type: 'match', pairs: [{ left: 'a', right: 'V3' }, { left: 'b', right: 'V3' }] }
    expect(checkAnswer(q, [1, 0]).correct).toBe(true)
  })
})

describe('typo tolerance (vocabulary spelling questions only)', () => {
  const vocab: TextQuestion = { ...base, type: 'gap', answers: ['documentation'], typoTolerant: true }
  const grammar: TextQuestion = { ...base, type: 'gap', answers: ['has lived'] }
  const opts = { forgiveTypos: true }

  it('accepts one slip in a long word and says it was a typo', () => {
    expect(checkAnswer(vocab, 'documentaition', opts)).toEqual({ correct: true, typo: true }) // extra letter
    expect(checkAnswer(vocab, 'documentaton', opts)).toEqual({ correct: true, typo: true }) // missing letter
    expect(checkAnswer(vocab, 'documnetation', opts)).toEqual({ correct: true, typo: true }) // swapped letters
  })
  it('an exact answer is a plain correct answer, not a typo', () => {
    expect(checkAnswer(vocab, 'Documentation', opts)).toEqual({ correct: true })
  })
  it('still rejects real mistakes and short words', () => {
    expect(checkAnswer(vocab, 'document', opts).correct).toBe(false)
    expect(checkAnswer(vocab, 'documentari', opts).correct).toBe(false)
    const short: TextQuestion = { ...base, type: 'gap', answers: ['take'], typoTolerant: true }
    expect(checkAnswer(short, 'make', opts).correct).toBe(false)
  })
  it('is off when the setting is off', () => {
    expect(checkAnswer(vocab, 'documentaition').correct).toBe(false)
    expect(checkAnswer(vocab, 'documentaition', { forgiveTypos: false }).correct).toBe(false)
  })
  it('never applies to grammar questions: has / had differ by one letter', () => {
    expect(checkAnswer(grammar, 'had lived', opts).correct).toBe(false)
    expect(checkAnswer(grammar, 'has livd', opts).correct).toBe(false)
    expect(checkAnswer(grammar, 'has lived', opts).correct).toBe(true)
  })
})
