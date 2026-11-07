import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTest, quoteFreeTextValues } from '@shared/testParser'

const errors = (src: string) => parseTest(src, 't.md').issues.filter((i) => i.severity === 'error')

describe('sample test file', () => {
  const src = readFileSync(resolve(__dirname, '../examples/tests/tenses-all-types.md'), 'utf8')
  const t = parseTest(src, 'tenses-all-types.md')

  it('parses without issues', () => {
    expect(t.issues).toEqual([])
  })
  it('reads frontmatter', () => {
    expect(t.title).toBe('Tenses — All Question Types')
    expect(t.topics).toContain('Passive')
  })
  it('covers all 8 types', () => {
    const types = new Set(t.blocks.map((b) => b.type))
    expect([...types].sort()).toEqual(['choice', 'error', 'gap', 'match', 'order', 'reading', 'tf', 'transform'])
  })
  it('flattens reading sub-questions into separate items', () => {
    const reading = t.items.filter((i) => i.reading)
    expect(reading.map((i) => i.id)).toEqual(['R1.1', 'R1.2', 'R1.3', 'R1.4', 'R1.5'])
    expect(reading[0].key).toBe('tenses-all-types.md#R1.1')
    expect(reading[0].reading?.passage).toContain('Olena')
  })
  it('keeps colons inside unquoted prompts', () => {
    const q = t.items.find((i) => i.id === 'Q8')!
    expect(q.prompt).toBe('Rewrite in the Passive: Someone stole my bike last night.')
  })
})

describe('format from the spec', () => {
  const src = `---
title: Week 45 — Tenses
topics: [Present Perfect, Past Perfect, Passive]
---

## Q1
type: choice
q: She ___ here since 2020.
options: [lives, has lived, is living, lived]
answer: has lived
explain: Since + a point in time and the action continues → Present Perfect.

## Q2
type: gap
q: By the time we arrived, the film ___ (already / start).
answer: had already started | had started
explain: ...

## Q3
type: transform
q: Rewrite in Passive: They are building a bridge.
answer: A bridge is being built.
explain: ...
`
  const t = parseTest(src, 'week45.md')
  it('parses all three questions', () => {
    expect(t.issues).toEqual([])
    expect(t.items).toHaveLength(3)
    const [q1, q2, q3] = t.items
    expect(q1.type === 'choice' && q1.answer).toBe('has lived')
    expect(q2.type === 'gap' && q2.answers).toEqual(['had already started', 'had started'])
    expect(q3.prompt).toBe('Rewrite in Passive: They are building a bridge.')
    expect(q1.topics).toEqual(['Present Perfect', 'Past Perfect', 'Passive'])
  })
})

describe('question-type details', () => {
  it('choice answer can be a letter or index', () => {
    const t = parseTest('## Q1\ntype: choice\nq: x\noptions: [a1, b1, c1]\nanswer: b\n## Q2\ntype: choice\nq: y\noptions: [a, b]\nanswer: 2\n', 't.md')
    expect(t.items.map((i) => i.type === 'choice' && i.answer)).toEqual(['b1', 'b'])
  })
  it('order chunks can be derived from a slash-separated answer', () => {
    const t = parseTest('## Q1\ntype: order\nanswer: I / have never been / to Paris\n', 't.md')
    const q = t.items[0]
    expect(q.type === 'order' && q.chunks).toEqual(['I', 'have never been', 'to Paris'])
    expect(q.type === 'order' && q.answers).toEqual(['I have never been to Paris'])
  })
  it('match accepts several pair notations', () => {
    const t = parseTest('## Q1\ntype: match\npairs:\n  - a: 1\n  - b = 2\n  - left: c\n    right: 3\n', 't.md')
    const q = t.items[0]
    expect(q.type === 'match' && q.pairs).toEqual([
      { left: 'a', right: '1' },
      { left: 'b', right: '2' },
      { left: 'c', right: '3' }
    ])
  })
  it('tf with not given enables the third option', () => {
    const t = parseTest('## Q1\ntype: tf\nq: x\nanswer: NG\n## Q2\ntype: tf\nq: y\nanswer: true\n', 't.md')
    expect(t.items.map((i) => i.type === 'tf' && [i.answer, i.notGiven])).toEqual([
      ['not given', true],
      ['true', false]
    ])
  })
  it('per-question topic overrides test topics', () => {
    const t = parseTest('---\ntopics: [A, B]\n---\n## Q1\ntype: gap\ntopic: C\nq: x ___\nanswer: y\n', 't.md')
    expect(t.items[0].topics).toEqual(['C'])
  })
  it('handles # inside text without treating it as a comment', () => {
    const t = parseTest('## Q1\ntype: gap\nq: Room #3 ___ cleaned.\nanswer: was\n', 't.md')
    expect(t.items[0].prompt).toBe('Room #3 ___ cleaned.')
  })
})

describe('word: links a question to a vocabulary word', () => {
  it('reads it on questions and on reading sub-questions, without warnings', () => {
    const t = parseTest(
      '## Q1\ntype: gap\nword: give up\nq: She is ___ her job.\nanswer: giving up\n\n## R1\ntype: reading\npassage: |\n  Text.\nquestions:\n  - type: tf\n    word: deadline\n    q: x\n    answer: true\n',
      't.md'
    )
    expect(t.issues).toEqual([])
    expect(t.items.map((i) => i.word)).toEqual(['give up', 'deadline'])
  })
  it('is optional', () => {
    expect(parseTest('## Q1\ntype: tf\nq: x\nanswer: true\n', 't.md').items[0].word).toBeUndefined()
  })
  it('keeps colons and quotes in the value', () => {
    expect(parseTest('## Q1\ntype: tf\nword: look forward to: something\nq: x\nanswer: true\n', 't.md').items[0].word).toBe('look forward to: something')
  })
})

describe('validation errors', () => {
  it('reports a missing answer with the line number', () => {
    const e = errors('---\ntitle: x\n---\n\n## Q1\ntype: gap\nq: a ___ b\n')
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ questionId: 'Q1', line: 5 })
    expect(e[0].message).toMatch(/answer/)
  })
  it('reports an answer that is not an option', () => {
    expect(errors('## Q1\ntype: choice\nq: x\noptions: [a, b]\nanswer: c\n')[0].message).toMatch(/not one of the options/)
  })
  it('reports unknown types', () => {
    expect(errors('## Q1\ntype: essay\nq: x\n')[0].message).toMatch(/Unknown type/)
  })
  it('reports broken YAML with an absolute line', () => {
    const e = errors('## Q1\ntype: choice\nq: x\noptions: [a, b\nanswer: a\n')
    expect(e[0].questionId).toBe('Q1')
    expect(e[0].line).toBeGreaterThan(1)
  })
  it('reports duplicate ids and empty files', () => {
    expect(errors('## Q1\ntype: tf\nq: x\nanswer: true\n## Q1\ntype: tf\nq: y\nanswer: false\n')[0].message).toMatch(/Duplicate/)
    expect(errors('just some text')[0].message).toMatch(/No questions/)
  })
  it('reports a reading block without passage and bad sub-questions', () => {
    expect(errors('## R1\ntype: reading\nquestions:\n  - type: tf\n    q: x\n    answer: true\n')[0].message).toMatch(/passage/)
    const e = errors('## R1\ntype: reading\npassage: |\n  Text.\nquestions:\n  - type: tf\n    q: x\n    answer: maybe\n')
    expect(e[0].questionId).toBe('R1.1')
  })
  it('keeps valid questions when others fail', () => {
    const t = parseTest('## Q1\ntype: tf\nq: x\nanswer: true\n## Q2\ntype: tf\nq: y\n', 't.md')
    expect(t.items).toHaveLength(1)
    expect(t.issues.filter((i) => i.severity === 'error')).toHaveLength(1)
  })
  it('warns about unknown keys', () => {
    const t = parseTest('## Q1\ntype: tf\nq: x\nanswer: true\nexplian: typo\n', 't.md')
    expect(t.issues[0]).toMatchObject({ severity: 'warning' })
  })
})

describe('quoteFreeTextValues', () => {
  it('does not touch block scalar content', () => {
    const src = 'passage: |\n  q: not a key\n  answer: still text\nq: real: one'
    expect(quoteFreeTextValues(src)).toBe('passage: |\n  q: not a key\n  answer: still text\nq: "real: one"')
  })
})
