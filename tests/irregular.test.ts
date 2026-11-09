import { describe, expect, it } from 'vitest'
import { buildQueue, checkVerb, formCorrect, GROUP_INFO, gradeFor, inScope, requeue, summarize, VERBS } from '@shared/irregular'
import { newSrs, reviewCard } from '@shared/srs'
import type { IrregularProgress } from '@shared/types'

const now = new Date('2026-11-09T10:00:00Z')
const verb = (id: string) => VERBS.find((v) => v.id === id)!

describe('irregular verbs data', () => {
  it('comes from the note: ids are unique, the top 60 are all there', () => {
    expect(new Set(VERBS.map((v) => v.id)).size).toBe(VERBS.length)
    expect(VERBS.filter((v) => v.top)).toHaveLength(60)
    expect(VERBS.length).toBeGreaterThan(170)
    for (const g of [1, 2, 3, 4, 5, 6, 7] as const) expect(VERBS.some((v) => v.group === g) && GROUP_INFO[g]).toBeTruthy()
  })
})

describe('checking answers', () => {
  it('ignores case and spaces, but not spelling', () => {
    expect(formCorrect(' Went ', 'went')).toBe(true)
    expect(formCorrect('wnet', 'went')).toBe(false)
    expect(formCorrect('', 'went')).toBe(false)
  })
  it('accepts any of several forms, or all of them', () => {
    expect(formCorrect('was', 'was / were')).toBe(true)
    expect(formCorrect('were', 'was / were')).toBe(true)
    expect(formCorrect('was/were', 'was / were')).toBe(true)
    expect(formCorrect('was/was', 'was / were')).toBe(false)
    expect(formCorrect('learned', 'learnt / learned')).toBe(true)
  })
  it('checks both forms of a verb', () => {
    expect(checkVerb(verb('go'), { v2: 'went', v3: 'gone' }).all).toBe(true)
    expect(checkVerb(verb('go'), { v2: 'went', v3: 'went' })).toEqual({ v2: true, v3: false, all: false })
  })
  it('grades Good only for a right answer', () => {
    expect(gradeFor(true)).toBe(3)
    expect(gradeFor(false)).toBe(1)
  })
})

describe('sessions', () => {
  it('starts with the most frequent verbs, limited to the new-verb limit', () => {
    const q = buildQueue({ kind: 'top' }, {}, now, 5)
    expect(q.map((v) => v.v1)).toEqual(['be', 'have', 'do', 'say', 'go'])
  })
  it('puts due verbs first, oldest first, then new ones; skips verbs that are not due', () => {
    const p: IrregularProgress = {}
    p.go = reviewCard(newSrs(new Date('2026-11-01T10:00:00Z')), 3, new Date('2026-11-01T10:00:00Z'), 0.9)
    p.be = reviewCard(newSrs(new Date('2026-11-05T10:00:00Z')), 3, new Date('2026-11-05T10:00:00Z'), 0.9)
    p.do = reviewCard(newSrs(now), 3, now, 0.9) // just reviewed: not due
    const q = buildQueue({ kind: 'top' }, p, new Date('2026-11-09T10:00:00Z'), 2).map((v) => v.id)
    expect(q.slice(0, 2)).toEqual(['go', 'be'])
    expect(q).not.toContain('do')
    expect(q).toHaveLength(4)
  })
  it('a group scope contains only that group; weak lists difficult verbs', () => {
    expect(inScope({ kind: 'group', group: 3 }, {}).every((v) => v.group === 3)).toBe(true)
    expect(inScope({ kind: 'weak' }, {})).toHaveLength(0)
  })
  it('a missed verb comes back a few cards later', () => {
    const q = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ ...verb('go'), id }))
    expect(requeue(q, 0).map((v) => v.id)).toEqual(['a', 'b', 'c', 'd', 'a', 'e', 'f'])
    expect(requeue(q.slice(0, 2), 1).map((v) => v.id)).toEqual(['a', 'b', 'b'])
  })
  it('summarises progress', () => {
    const p: IrregularProgress = { go: reviewCard(newSrs(now), 1, now, 0.9) }
    expect(summarize(VERBS, p, now)).toMatchObject({ total: VERBS.length, started: 1, known: 0 })
  })
})
