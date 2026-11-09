import { IRREGULAR_VERBS } from './irregularData'
import { newSrs } from './srs'
import type { IrregularGroup, IrregularProgress, IrregularVerb, SrsCard } from './types'

export const VERBS: IrregularVerb[] = IRREGULAR_VERBS

export const GROUP_INFO: Record<IrregularGroup, { title: string; scheme: string; example: string; tip: string }> = {
  1: { title: 'All three the same', scheme: 'V1 = V2 = V3', example: 'cut — cut — cut', tip: 'Nothing to learn but the list: the form never changes.' },
  2: { title: 'Second = third', scheme: 'V1 ≠ V2 = V3', example: 'buy — bought — bought', tip: 'Sounds repeat: -ought/-aught, -ept, -ent, -old, -ound.' },
  3: { title: 'First = third', scheme: 'V1 = V3 ≠ V2', example: 'come — came — come', tip: 'Only the past simple changes.' },
  4: { title: 'First = second', scheme: 'V1 = V2 ≠ V3', example: 'beat — beat — beaten', tip: 'Only the participle changes.' },
  5: { title: 'All different', scheme: 'V1 ≠ V2 ≠ V3', example: 'go — went — gone', tip: 'Learn five at a time, out loud.' },
  6: { title: 'Rare & literary', scheme: '—', example: 'slay — slew — slain', tip: 'Seen in books and films; low priority.' },
  7: { title: 'Two correct forms', scheme: 'learnt / learned', example: 'burn — burnt / burned', tip: 'British often -t, American -ed. Both are correct.' }
}

export const GROUPS: IrregularGroup[] = [1, 2, 3, 4, 5, 6, 7]

/** The 60 most frequent verbs, then the rest by group. */
export const ORDER: IrregularVerb[] = [...VERBS].sort((a, b) => (a.top ?? 1000) - (b.top ?? 1000) || a.group - b.group)

export type VerbScope = { kind: 'top' } | { kind: 'group'; group: IrregularGroup } | { kind: 'all' } | { kind: 'weak' }

export function inScope(scope: VerbScope, progress: IrregularProgress): IrregularVerb[] {
  switch (scope.kind) {
    case 'top':
      return ORDER.filter((v) => v.top)
    case 'group':
      return VERBS.filter((v) => v.group === scope.group)
    case 'weak':
      return ORDER.filter((v) => isWeak(progress[v.id]))
    default:
      return ORDER
  }
}

/** Accepted spellings of a form: "was / were" → ["was", "were"]. */
export function acceptedForms(form: string): string[] {
  return form
    .split('/')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

const clean = (s: string): string => s.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ')

/** Whether a typed answer matches a form. For "was / were" either one, or both ("was/were"), is fine. No typo tolerance: the exact spelling is what is being learnt. */
export function formCorrect(typed: string, form: string): boolean {
  const t = clean(typed)
  if (!t) return false
  const ok = acceptedForms(form)
  if (ok.includes(t)) return true
  const parts = t.split('/').map((s) => s.trim()).filter(Boolean)
  return parts.length > 1 && parts.every((p) => ok.includes(p)) && new Set(parts).size === parts.length
}

export interface VerbCheck {
  v2: boolean
  v3: boolean
  all: boolean
}

export function checkVerb(verb: IrregularVerb, typed: { v2: string; v3: string }): VerbCheck {
  const v2 = formCorrect(typed.v2, verb.v2)
  const v3 = formCorrect(typed.v3, verb.v3)
  return { v2, v3, all: v2 && v3 }
}

/** Grade for FSRS: Good when both forms were right at the first try, otherwise Again. */
export const gradeFor = (firstTryCorrect: boolean): 1 | 3 => (firstTryCorrect ? 3 : 1)

// ───────────── progress ─────────────

const isLearned = (c: SrsCard | undefined): boolean => Boolean(c) && c!.state !== 0
export const isDueVerb = (c: SrsCard | undefined, now: Date): boolean => isLearned(c) && new Date(c!.due).getTime() <= now.getTime()
export const isWeak = (c: SrsCard | undefined): boolean => Boolean(c) && c!.state !== 0 && (c!.lapses >= 2 || c!.difficulty >= 7.5)
/** Stable for three weeks or more: it will not be asked soon. */
export const isKnown = (c: SrsCard | undefined): boolean => Boolean(c) && c!.state === 2 && c!.stability >= 21

export interface Summary {
  total: number
  started: number
  known: number
  due: number
  weak: number
}

export function summarize(verbs: IrregularVerb[], progress: IrregularProgress, now: Date): Summary {
  let started = 0
  let known = 0
  let due = 0
  let weak = 0
  for (const v of verbs) {
    const c = progress[v.id]
    if (isLearned(c)) started++
    if (isKnown(c)) known++
    if (isDueVerb(c, now)) due++
    if (isWeak(c)) weak++
  }
  return { total: verbs.length, started, known, due, weak }
}

/** Today's work: due verbs (the oldest first), then new ones in the order of the scope, up to `newLimit`. */
export function buildQueue(scope: VerbScope, progress: IrregularProgress, now: Date, newLimit: number, shuffle: (list: IrregularVerb[]) => IrregularVerb[] = (l) => l): IrregularVerb[] {
  const verbs = inScope(scope, progress)
  const due = verbs.filter((v) => isDueVerb(progress[v.id], now)).sort((a, b) => progress[a.id].due.localeCompare(progress[b.id].due))
  const fresh = verbs.filter((v) => !isLearned(progress[v.id])).slice(0, Math.max(0, newLimit))
  return [...shuffle(due), ...fresh]
}

/** A verb that was just answered wrongly comes back a few cards later; the rest of the queue is untouched. */
export function requeue(queue: IrregularVerb[], index: number, gap = 3): IrregularVerb[] {
  const next = [...queue]
  next.splice(Math.min(next.length, index + 1 + gap), 0, queue[index])
  return next
}

export const freshCard = (now: Date): SrsCard => newSrs(now)
