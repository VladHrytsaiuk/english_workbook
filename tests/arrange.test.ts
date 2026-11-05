import { describe, expect, it } from 'vitest'
import { arrangeItems } from '@shared/arrange'
import { parseTest } from '@shared/testParser'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sample = parseTest(readFileSync(resolve(__dirname, '../examples/tests/tenses-all-types.md'), 'utf8'), 's.md').items

// Deterministic pseudo-random sequence for repeatable tests.
// mulberry32
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

describe('arrangeItems', () => {
  it('keeps everything when shuffling is off', () => {
    expect(arrangeItems(sample, { questions: false, answers: false })).toEqual(sample)
  })

  it('shuffles questions but keeps every question exactly once', () => {
    const out = arrangeItems(sample, { questions: true, answers: false }, seeded(7))
    expect(out.map((i) => i.key).sort()).toEqual(sample.map((i) => i.key).sort())
    expect(out.map((i) => i.key)).not.toEqual(sample.map((i) => i.key))
  })

  it('keeps reading sub-questions together and in their order', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const ids = arrangeItems(sample, { questions: true, answers: true }, seeded(seed)).map((i) => i.id)
      const start = ids.indexOf('R1.1')
      expect(ids.slice(start, start + 5)).toEqual(['R1.1', 'R1.2', 'R1.3', 'R1.4', 'R1.5'])
    }
  })

  it('shuffles choice options without changing the right answer', () => {
    const before = sample.filter((i) => i.type === 'choice')
    const after = arrangeItems(sample, { questions: false, answers: true }, seeded(11)).filter((i) => i.type === 'choice')
    after.forEach((q, k) => {
      const orig = before[k]
      if (q.type !== 'choice' || orig.type !== 'choice') throw new Error('type')
      expect([...q.options].sort()).toEqual([...orig.options].sort())
      expect(q.answer).toBe(orig.answer)
    })
    expect(after.map((q) => (q.type === 'choice' ? q.options.indexOf(q.answer) : -1))).not.toEqual(before.map((q) => (q.type === 'choice' ? q.options.indexOf(q.answer) : -1)))
  })

  it('moves the right answer around across sessions', () => {
    const q = sample.find((i) => i.id === 'Q1')
    if (!q || q.type !== 'choice') throw new Error('Q1')
    const positions = new Set<number>()
    for (let s = 1; s <= 40; s++) {
      const a = arrangeItems([q], { questions: false, answers: true }, seeded(s))[0]
      if (a.type === 'choice') positions.add(a.options.indexOf(a.answer))
    }
    expect(positions.size).toBe(4)
  })
})
