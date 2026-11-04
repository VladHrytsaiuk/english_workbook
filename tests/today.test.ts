import { describe, expect, it } from 'vitest'
import { activityByDay, dayKey, minutesFor, streak, suggestedTest, weakTopic } from '../src/renderer/src/lib/today'
import { parseTest } from '@shared/testParser'
import type { Attempt, QuestionResult } from '@shared/types'

const now = new Date('2026-11-04T18:00:00')
const daysAgo = (n: number): string => new Date(now.getTime() - n * 86_400_000).toISOString()
const res = (topic: string, correct: boolean): QuestionResult => ({ key: 'k', questionId: 'Q', type: 'gap', topics: [topic], correct, userAnswer: '', correctAnswer: '' })
const attempt = (finishedAt: string, results: QuestionResult[], testId = 't.md', mode: Attempt['mode'] = 'full'): Attempt => ({
  id: finishedAt, testId, testTitle: 'T', mode, startedAt: finishedAt, finishedAt, completed: true, total: results.length, correct: results.filter((r) => r.correct).length, results
})

describe('streak', () => {
  it('counts consecutive active days ending today or yesterday', () => {
    const logs = [0, 1, 2, 4].map((d) => ({ entryId: 'x', grade: 3 as const, mode: 'flashcard' as const, at: daysAgo(d), prevState: 2 }))
    expect(streak(activityByDay([], logs), now)).toBe(3)
    const fromYesterday = [1, 2].map((d) => ({ entryId: 'x', grade: 3 as const, mode: 'flashcard' as const, at: daysAgo(d), prevState: 2 }))
    expect(streak(activityByDay([], fromYesterday), now)).toBe(2)
    expect(streak(activityByDay([], []), now)).toBe(0)
  })
  it('uses local days', () => {
    expect(dayKey('2026-11-04T23:30:00')).toBe('2026-11-04')
  })
})

describe('weakTopic', () => {
  const test = parseTest('---\ntopics: [Mixed]\n---\n## Q1\ntype: gap\ntopic: Past Perfect\nq: a ___\nanswer: b\n## Q2\ntype: gap\ntopic: Passive\nq: c ___\nanswer: d\n', 't.md')
  it('picks the lowest-accuracy topic that has questions', () => {
    const a = [attempt(daysAgo(2), [res('Past Perfect', false), res('Past Perfect', false), res('Past Perfect', true), res('Passive', true), res('Passive', true), res('Passive', false)])]
    const w = weakTopic(a, [test], now)
    expect(w?.topic).toBe('Past Perfect')
    expect(w?.accuracy).toBe(33)
    expect(w?.items.map((i) => i.id)).toEqual(['Q1'])
  })
  it('ignores topics with too few answers, good accuracy or old attempts', () => {
    expect(weakTopic([attempt(daysAgo(2), [res('Past Perfect', false)])], [test], now)).toBeNull()
    expect(weakTopic([attempt(daysAgo(2), [res('Passive', true), res('Passive', true), res('Passive', true)])], [test], now)).toBeNull()
    expect(weakTopic([attempt(daysAgo(40), [res('Passive', false), res('Passive', false), res('Passive', false)])], [test], now)).toBeNull()
  })
})

describe('suggestedTest', () => {
  const a = { ...parseTest('## Q1\ntype: tf\nq: x\nanswer: true\n', 'a.md'), mtime: 1 }
  const b = { ...parseTest('## Q1\ntype: tf\nq: x\nanswer: true\n', 'b.md'), mtime: 2 }
  it('prefers tests never taken (newest first)', () => {
    expect(suggestedTest([a, b], [], now)?.test.id).toBe('b.md')
    expect(suggestedTest([a, b], [attempt(daysAgo(1), [], 'b.md')], now)?.test.id).toBe('a.md')
  })
  it('then the one taken longest ago, if older than 3 days', () => {
    expect(suggestedTest([a, b], [attempt(daysAgo(10), [], 'a.md'), attempt(daysAgo(5), [], 'b.md')], now)?.test.id).toBe('a.md')
    expect(suggestedTest([a, b], [attempt(daysAgo(1), [], 'a.md'), attempt(daysAgo(2), [], 'b.md')], now)).toBeNull()
  })
})

it('estimates minutes', () => {
  expect(minutesFor(30, 0)).toBe(5)
  expect(minutesFor(0, 3)).toBe(2)
})
