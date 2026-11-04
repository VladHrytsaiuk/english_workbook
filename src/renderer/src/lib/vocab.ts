import { isDifficult, isDue, makeCloze, statusOf } from '@shared/srs'
import type { Deck, ReviewMode, ReviewModePref, Settings, VocabEntry, VocabReviewLog } from '@shared/types'

export type SmartId = 'all' | 'due' | 'new' | 'learning' | 'difficult' | 'mastered' | 'suspended'

/** A view of the library: a smart filter, a deck, an auto-topic, a tag or a source. */
export type VocabScope =
  | { kind: 'smart'; id: SmartId }
  | { kind: 'deck'; id: string } // 'none' = words without a deck
  | { kind: 'topic'; name: string }
  | { kind: 'tag'; name: string }
  | { kind: 'source'; id: VocabEntry['source']['kind'] }
  | { kind: 'ids'; ids: string[]; label: string }
  | { kind: 'file'; ref: string }

export const ALL_SCOPE: VocabScope = { kind: 'smart', id: 'all' }

export const SMART_LABELS: Record<SmartId, string> = {
  all: 'All words',
  due: 'Due now',
  new: 'New',
  learning: 'Learning',
  difficult: 'Difficult',
  mastered: 'Mastered',
  suspended: 'Suspended'
}

export const SOURCE_LABELS: Record<VocabEntry['source']['kind'], string> = {
  note: 'From notes',
  test: 'From tests',
  other: 'Added manually',
  file: 'From files'
}

export function scopeKey(s: VocabScope): string {
  if (s.kind === 'ids') return `ids:${s.ids.join(',')}`
  if (s.kind === 'file') return `file:${s.ref}`
  return s.kind === 'smart' || s.kind === 'deck' || s.kind === 'source' ? `${s.kind}:${s.id}` : `${s.kind}:${s.name}`
}

export function scopeLabel(s: VocabScope, decks: Deck[]): string {
  switch (s.kind) {
    case 'smart':
      return SMART_LABELS[s.id]
    case 'deck':
      return s.id === 'none' ? 'No deck' : (decks.find((d) => d.id === s.id)?.name ?? 'Deck')
    case 'topic':
      return s.name
    case 'tag':
      return `#${s.name}`
    case 'source':
      return SOURCE_LABELS[s.id]
    case 'ids':
      return s.label
    case 'file':
      return s.ref.replace(/\.md$/i, '')
  }
}

export function inScope(e: VocabEntry, s: VocabScope, now: Date): boolean {
  if (s.kind === 'smart') {
    if (s.id === 'all') return true
    if (s.id === 'suspended') return Boolean(e.suspended)
    if (e.suspended) return false
    switch (s.id) {
      case 'due':
        return isDue(e, now)
      case 'new':
        return statusOf(e) === 'new'
      case 'learning':
        return statusOf(e) === 'learning'
      case 'difficult':
        return isDifficult(e)
      case 'mastered':
        return statusOf(e) === 'mastered'
    }
  }
  if (s.kind === 'deck') return s.id === 'none' ? !e.deckId : e.deckId === s.id
  if (s.kind === 'topic') return e.topic === s.name
  if (s.kind === 'tag') return e.tags.includes(s.name)
  if (s.kind === 'ids') return s.ids.includes(e.id)
  if (s.kind === 'file') return e.source.kind === 'file' && e.source.ref === s.ref
  return e.source.kind === s.id
}

export function startOfToday(now = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

/** How many new cards were introduced and reviews done today (for the daily limits). */
export function todayCounts(logs: VocabReviewLog[], now = new Date()): { newSeen: number; reviews: number } {
  const from = startOfToday(now).toISOString()
  const today = logs.filter((l) => l.at >= from)
  return {
    newSeen: new Set(today.filter((l) => l.prevState === 0).map((l) => l.entryId)).size,
    reviews: today.filter((l) => l.prevState !== 0).length
  }
}

/**
 * The study queue for a scope: due cards (oldest first) within the daily review limit, mixed with
 * new cards within the daily new-card limit. With `cram`, every card in the scope is included.
 */
export function buildQueue(entries: VocabEntry[], scope: VocabScope, settings: Settings, logs: VocabReviewLog[], now: Date, cram = false): VocabEntry[] {
  const base = entries.filter((e) => !e.suspended && inScope(e, scope, now))
  if (cram) return [...base].sort(() => Math.random() - 0.5)
  const { newSeen, reviews } = todayCounts(logs, now)
  const due = base
    .filter((e) => isDue(e, now))
    .sort((a, b) => a.srs.due.localeCompare(b.srs.due))
    .slice(0, Math.max(0, settings.reviewsPerDay - reviews))
  const fresh = base
    .filter((e) => e.srs.state === 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, Math.max(0, settings.newCardsPerDay - newSeen))
  // Interleave: one new card after every 3 reviews, so new words don't all come at the end.
  const out: VocabEntry[] = []
  let n = 0
  for (const e of due) {
    out.push(e)
    if (++n % 3 === 0 && fresh.length) out.push(fresh.shift() as VocabEntry)
  }
  return [...out, ...fresh]
}

/** Picks how a card is practised. New cards are always shown as a flashcard first. */
export function pickMode(e: VocabEntry, pref: ReviewModePref, canChoice: boolean): ReviewMode {
  const cloze = Boolean(makeCloze(e.context, e.text))
  if (pref !== 'mixed') {
    if (pref === 'cloze' && !cloze) return 'typing'
    if (pref === 'choice' && !canChoice) return 'flashcard'
    return pref
  }
  if (e.srs.state === 0) return 'flashcard'
  const options: ReviewMode[] = ['flashcard', 'typing', ...(cloze ? (['cloze', 'cloze'] as ReviewMode[]) : []), ...(canChoice ? (['choice'] as ReviewMode[]) : [])]
  let h = e.srs.reps
  for (const c of e.id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return options[h % options.length]
}

// ───────────── speech ─────────────

let voice: SpeechSynthesisVoice | null | undefined
let preferredVoice: string | null = null

// Re-pick the voice when macOS finishes loading voices or a new one is downloaded.
window.speechSynthesis?.addEventListener('voiceschanged', () => {
  voice = undefined
})

/** Set from Settings → Vocabulary review → Voice. */
export function setPreferredVoice(name: string | null): void {
  if (name !== preferredVoice) voice = undefined
  preferredVoice = name
}

/**
 * Natural voices in order of preference (mostly female US voices first). macOS localises voice names,
 * so each voice is listed in English and Ukrainian.
 */
const PREFERRED = [
  ['Zoe', 'Зоя', 'Зої', 'Зоі'],
  ['Ava', 'Ава', 'Ейва'],
  ['Samantha', 'Саманта'],
  ['Allison', 'Еллісон', 'Елісон'],
  ['Susan', 'Сьюзен', 'Сюзен'],
  ['Shelley', 'Шеллі'],
  ['Flo', 'Фло'],
  ['Sandy', 'Сенді'],
  ['Evan', 'Еван'],
  ['Tom', 'Том'],
  ['Daniel', 'Даніель'],
  ['Karen', 'Карен'],
  ['Moira', 'Мойра'],
  ['Tessa', 'Тесса']
]
/** Novelty / joke voices (Bubbles, Organ, Zarvox…) — listed last and never picked automatically. */
const NOVELTY =
  /^(Albert|Альберт|Bad News|Погані новини|Bahh|Бахх|Bells|Дзвони|Boing|Пружина|Bubbles|Бульбашки|Cellos|Віолончель|Good News|Хороші новини|Jester|Істеричний|Organ|Орган|Superstar|Суперзірка|Trinoids|Триноїди|Whisper|Шепіт|Wobble|Вібрато|Zarvox|Зарвокс|Junior|Підліток|Ralph|Ральф|Grandma|Grandpa|Rocko|Fred|Фред|Kathy|Кеті)(?=\s|\(|$)/i

function voiceScore(v: SpeechSynthesisVoice): number {
  const lang = v.lang.replace('_', '-')
  const i = PREFERRED.findIndex((names) => names.some((n) => new RegExp(`^${n}(?=\\s|\\(|$)`, 'i').test(v.name)))
  return (
    // e.g. "Zoe (Premium)" / "Зоя (високої якості)", "Ava (Enhanced)" / "Ава (покращений)"
    (/premium|преміум|високої якості|висока якість/i.test(v.name) ? 100 : /enhanced|покращ|розширен/i.test(v.name) ? 50 : 0) +
    (i >= 0 ? 30 - i : 0) +
    (lang === 'en-US' ? 5 : lang === 'en-GB' ? 3 : 0) -
    (NOVELTY.test(v.name) ? 200 : 0)
  )
}

/** English voices available to the app, best first. Siri voices are not available to apps on macOS. */
export function englishVoices(): SpeechSynthesisVoice[] {
  const voices = window.speechSynthesis?.getVoices() ?? []
  return voices.filter((v) => v.lang.replace('_', '-').startsWith('en')).sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name))
}

function englishVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined) return voice
  const list = englishVoices()
  if (!list.length) return null
  voice = (preferredVoice && list.find((v) => v.name === preferredVoice)) || list[0]
  return voice
}

/** Reads English text aloud with a macOS system voice. */
export function speak(text: string): void {
  const synth = window.speechSynthesis
  if (!synth) return
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 0.92
  const v = englishVoice()
  if (v) u.voice = v
  synth.speak(u)
}

export const STATUS_STYLE: Record<ReturnType<typeof statusOf> | 'suspended', { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
  learning: { label: 'Learning', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  review: { label: 'Review', className: 'bg-primary/12 text-primary' },
  mastered: { label: 'Mastered', className: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400' },
  suspended: { label: 'Suspended', className: 'bg-muted text-muted-foreground' }
}
