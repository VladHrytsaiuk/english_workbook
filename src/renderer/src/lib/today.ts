import type { Attempt, ParsedTest, TestItem, VocabReviewLog } from '@shared/types'

/** Local calendar day, e.g. 2026-11-04. */
export function dayKey(d: Date | string): string {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export interface DayActivity {
  reviews: number
  answers: number
}

/** Word reviews and test answers per local day. */
export function activityByDay(attempts: Attempt[], logs: VocabReviewLog[]): Map<string, DayActivity> {
  const m = new Map<string, DayActivity>()
  const get = (k: string): DayActivity => m.get(k) ?? (m.set(k, { reviews: 0, answers: 0 }).get(k) as DayActivity)
  for (const l of logs) get(dayKey(l.at)).reviews++
  for (const a of attempts) get(dayKey(a.finishedAt)).answers += a.results.length
  return m
}

/** Consecutive days with any activity, ending today (or yesterday, if nothing has been done yet today). */
export function streak(activity: Map<string, DayActivity>, now = new Date()): number {
  const has = (d: Date): boolean => {
    const a = activity.get(dayKey(d))
    return Boolean(a && a.reviews + a.answers > 0)
  }
  const d = new Date(now)
  if (!has(d)) d.setDate(d.getDate() - 1)
  let n = 0
  while (has(d)) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export interface WeakTopic {
  topic: string
  accuracy: number
  answered: number
  items: TestItem[]
}

/**
 * The topic with the lowest accuracy over the last 30 days (at least 3 answers, below 80 %) that has
 * questions in the current tests. Practising it pulls questions on that topic from every test.
 */
export function weakTopic(attempts: Attempt[], tests: ParsedTest[], now = new Date(), maxItems = 10): WeakTopic | null {
  const from = new Date(now.getTime() - 30 * 86_400_000).toISOString()
  const stats = new Map<string, { right: number; total: number }>()
  for (const a of attempts) {
    if (a.finishedAt < from) continue
    for (const r of a.results)
      for (const t of r.topics) {
        const s = stats.get(t) ?? { right: 0, total: 0 }
        s.total++
        if (r.correct) s.right++
        stats.set(t, s)
      }
  }
  const candidates = [...stats.entries()]
    .filter(([, s]) => s.total >= 3 && s.right / s.total < 0.8)
    .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total || b[1].total - a[1].total)
  for (const [topic, s] of candidates) {
    const seen = new Set<string>()
    const items = tests.flatMap((t) => t.items).filter((i) => i.topics.includes(topic) && !seen.has(i.key) && seen.add(i.key))
    if (items.length) {
      const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, maxItems)
      return { topic, accuracy: Math.round((s.right / s.total) * 100), answered: s.total, items: shuffled }
    }
  }
  return null
}

/** A test worth doing: one never taken (newest file first), otherwise the one taken longest ago (3+ days). */
export function suggestedTest(tests: ParsedTest[], attempts: Attempt[], now = new Date()): { test: ParsedTest; lastAt?: string } | null {
  const usable = tests.filter((t) => t.items.length > 0)
  const last = new Map<string, string>()
  for (const a of attempts) if (a.mode === 'full' && (!last.has(a.testId) || (last.get(a.testId) as string) < a.finishedAt)) last.set(a.testId, a.finishedAt)
  const fresh = usable.filter((t) => !last.has(t.id)).sort((a, b) => b.mtime - a.mtime)
  if (fresh.length) return { test: fresh[0] }
  const stale = usable
    .filter((t) => now.getTime() - new Date(last.get(t.id) as string).getTime() > 3 * 86_400_000)
    .sort((a, b) => (last.get(a.id) as string).localeCompare(last.get(b.id) as string))
  return stale.length ? { test: stale[0], lastAt: last.get(stale[0].id) } : null
}

/** Rough time estimate for a plan item, in minutes. */
export const minutesFor = (cards: number, questions: number): number => Math.max(1, Math.round((cards * 10 + questions * 40) / 60))
