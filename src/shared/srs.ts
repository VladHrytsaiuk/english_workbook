import { type Card, createEmptyCard, fsrs, generatorParameters, type Grade } from 'ts-fsrs'
import type { TypedVerdict } from './answer'
import { phraseForms } from './inflect'
import type { SrsCard, SrsGrade, VocabEntry } from './types'

// ───────────── conversion between ts-fsrs Card and JSON-friendly SrsCard ─────────────

export function toSrs(card: Card): SrsCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as SrsCard['state'],
    ...(card.last_review ? { last_review: card.last_review.toISOString() } : {})
  }
}

export function fromSrs(s: SrsCard): Card {
  return {
    ...s,
    due: new Date(s.due),
    last_review: s.last_review ? new Date(s.last_review) : undefined
  }
}

export function newSrs(now: Date | string = new Date()): SrsCard {
  return toSrs(createEmptyCard(new Date(now)))
}

// ───────────── scheduling ─────────────

const schedulers = new Map<number, ReturnType<typeof fsrs>>()

/** One FSRS scheduler per desired-retention value (fuzz on, so cards learned together spread out). */
function scheduler(retention: number): ReturnType<typeof fsrs> {
  const r = Math.min(0.97, Math.max(0.7, retention))
  let s = schedulers.get(r)
  if (!s) {
    s = fsrs(generatorParameters({ request_retention: r, enable_fuzz: true, enable_short_term: true }))
    schedulers.set(r, s)
  }
  return s
}

export function reviewCard(srs: SrsCard, grade: SrsGrade, now: Date, retention: number): SrsCard {
  return toSrs(scheduler(retention).next(fromSrs(srs), now, grade as Grade).card)
}

/** Next due date for each grade, for labels like "10m · 1d · 3d · 8d" on the buttons. */
export function previewDue(srs: SrsCard, now: Date, retention: number): Record<SrsGrade, Date> {
  const p = scheduler(retention).repeat(fromSrs(srs), now)
  return { 1: p[1].card.due, 2: p[2].card.due, 3: p[3].card.due, 4: p[4].card.due }
}

export function formatInterval(from: Date, to: Date): string {
  const min = Math.max(1, Math.round((to.getTime() - from.getTime()) / 60000))
  if (min < 60) return `${min}m`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 31) return `${d}d`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo}mo`
  return `${(d / 365).toFixed(1).replace(/\.0$/, '')}y`
}

// ───────────── word status ─────────────

export type WordStatus = 'new' | 'learning' | 'review' | 'mastered'

/** A card counts as mastered once FSRS expects it to stay remembered for 3+ weeks. */
export const MASTERED_STABILITY_DAYS = 21

export function statusOf(e: Pick<VocabEntry, 'srs'>): WordStatus {
  const s = e.srs
  if (s.state === 0) return 'new'
  if (s.state === 1 || s.state === 3) return 'learning'
  return s.stability >= MASTERED_STABILITY_DAYS ? 'mastered' : 'review'
}

/** Started (not new), not suspended, and due by `now`. */
export function isDue(e: Pick<VocabEntry, 'srs' | 'suspended'>, now: Date): boolean {
  return !e.suspended && e.srs.state !== 0 && new Date(e.srs.due).getTime() <= now.getTime()
}

export function isDifficult(e: Pick<VocabEntry, 'srs'>): boolean {
  return e.srs.lapses >= 2 || (e.srs.state !== 0 && e.srs.difficulty >= 7.5)
}

// ───────────── typed answers ─────────────

export { checkTyped, type TypedVerdict } from './answer'

/** Suggested FSRS grade for an automatically checked answer. */
export function suggestedGrade(verdict: TypedVerdict): SrsGrade {
  return verdict === 'correct' ? 3 : verdict === 'typo' ? 2 : 1
}

/**
 * Replaces the word inside its context sentence with a gap. Returns null when the word isn't found.
 * - A leading "to" / article of the saved word is optional ("to give up" is found in "Don't give up").
 * - Other grammatical forms are found too ("give up" in "She is giving up", "He gave up"); then `inflected` is true
 *   and `form` is the exact text that stood in the sentence — that is what the learner has to type.
 */
export function makeCloze(context: string | undefined, text: string): { before: string; after: string; form: string; inflected: boolean } | null {
  if (!context) return null
  const full = text.trim()
  const bare = full.replace(/^(to|a|an|the)\s+(?=\S)/i, '')
  const search = (candidates: string[]): RegExpExecArray | null => {
    const alternatives = [...new Set(candidates)]
      .sort((x, y) => y.length - x.length)
      .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'))
    return new RegExp(`(^|[^\\p{L}])(${alternatives.join('|')})(?=[^\\p{L}]|$)`, 'iu').exec(context)
  }
  // The saved form first, then every other form of the word.
  for (const [candidates, inflected] of [
    [bare === full ? [full] : [full, bare], false],
    [phraseForms(bare), true]
  ] as const) {
    const m = search([...candidates])
    if (m) {
      const start = m.index + m[1].length
      return { before: context.slice(0, start), after: context.slice(start + m[2].length), form: m[2], inflected: inflected && m[2].toLowerCase().replace(/\s+/g, ' ') !== bare.toLowerCase().replace(/\s+/g, ' ') }
    }
  }
  return null
}
