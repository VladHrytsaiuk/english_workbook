import { randomUUID } from 'node:crypto'
import { newSrs, reviewCard, statusOf } from '@shared/srs'
import { dedupKey } from '@shared/dedup'
import type { Deck, ReviewMode, SrsGrade, VocabEntry, VocabInput, VocabReviewLog } from '@shared/types'
import type { ParsedVocabFile } from '@shared/vocabParser'
import { getSettings } from './data'
import { JsonFile } from './storage'

const vocabFile = new JsonFile<VocabEntry[]>('vocabulary.json', () => [], 'workbook')
const decksFile = new JsonFile<Deck[]>('decks.json', () => [], 'workbook')
const reviewsFile = new JsonFile<VocabReviewLog[]>('vocab-reviews.json', () => [], 'workbook')

/** Review history kept for stats (oldest entries are dropped beyond this). */
const MAX_REVIEW_LOGS = 50_000

export const DECK_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6']

const now = (): string => new Date().toISOString()
const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')
const uniq = (list: string[]): string[] => [...new Map(list.filter(Boolean).map((x) => [x.trim().toLowerCase(), x.trim()])).values()]
const cleanTags = (tags: string[]): string[] => [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))]

/** Fills fields added in later versions, so entries saved by older builds keep working. */
function normalize(e: Partial<VocabEntry> & Pick<VocabEntry, 'id' | 'text' | 'translation' | 'createdAt'>): VocabEntry {
  return {
    ...e,
    source: e.source ?? { kind: 'other', title: '' },
    tags: Array.isArray(e.tags) ? e.tags : [],
    srs: e.srs ?? newSrs(e.createdAt)
  } as VocabEntry
}

function all(): VocabEntry[] {
  return vocabFile.get().map(normalize)
}

function save(list: VocabEntry[]): void {
  vocabFile.set(list)
}

// ───────────── words ─────────────

export function listVocab(): VocabEntry[] {
  return all().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Adds a word. If the same word/phrase is already saved, its learning progress, deck and tags are kept
 * and only the new information (translation, explanation, context, source) is merged in.
 */
export function addVocab(input: VocabInput): VocabEntry {
  const list = all()
  const key = dedupKey(input.text)
  const existing = list.find((v) => dedupKey(v.text) === key)
  if (existing) {
    const merged: VocabEntry = {
      ...existing,
      // An automatic translation (popover) never replaces yours; a translation typed in the app does.
      translation: (input.source?.kind === 'other' ? input.translation : existing.translation) || existing.translation || input.translation,
      explanation: input.explanation ?? existing.explanation,
      // Keep the original sentence; a new one becomes an extra example.
      context: existing.context ?? input.context,
      examples: uniq([
        ...(existing.examples ?? []),
        ...(input.examples ?? []),
        ...(existing.context && input.context && dedupKey(input.context) !== dedupKey(existing.context) ? [input.context] : [])
      ]),
      source: existing.source.kind === 'other' && input.source ? input.source : existing.source,
      deckId: input.deckId ?? existing.deckId,
      tags: cleanTags([...existing.tags, ...(input.tags ?? [])]),
      updatedAt: now()
    }
    save(list.map((v) => (v.id === existing.id ? merged : v)))
    return merged
  }
  const entry = normalize({ ...input, id: input.id || randomUUID(), tags: cleanTags(input.tags ?? []), srs: newSrs(input.createdAt) })
  save([...list, entry])
  return entry
}

export function findVocab(text: string): VocabEntry | undefined {
  const key = dedupKey(text)
  return key ? all().find((v) => dedupKey(v.text) === key) : undefined
}

/**
 * Merges entries that are the same word (see `dedupKey`) — e.g. saved by older versions as "give up" and
 * "to give up". The entry with the most review history wins; tags, examples and notes are combined and
 * review logs are re-pointed to the kept entry. Returns how many duplicates were merged.
 */
export function mergeDuplicates(): number {
  const list = all()
  const groups = new Map<string, VocabEntry[]>()
  for (const v of list) groups.set(dedupKey(v.text), [...(groups.get(dedupKey(v.text)) ?? []), v])
  const dupes = [...groups.values()].filter((g) => g.length > 1)
  if (!dupes.length) return 0
  const remap = new Map<string, string>()
  const removed = new Set<string>()
  const merged = new Map<string, VocabEntry>()
  for (const g of dupes) {
    const sorted = [...g].sort((a, b) => b.srs.reps - a.srs.reps || a.createdAt.localeCompare(b.createdAt))
    const keep = sorted[0]
    const others = sorted.slice(1)
    merged.set(keep.id, {
      ...keep,
      translation: keep.translation || others.find((o) => o.translation)?.translation || '',
      explanation: keep.explanation ?? others.find((o) => o.explanation)?.explanation,
      context: keep.context ?? others.find((o) => o.context)?.context,
      deckId: keep.deckId ?? others.find((o) => o.deckId)?.deckId,
      topic: keep.topic ?? others.find((o) => o.topic)?.topic,
      pos: keep.pos ?? others.find((o) => o.pos)?.pos,
      ipa: keep.ipa ?? others.find((o) => o.ipa)?.ipa,
      level: keep.level ?? others.find((o) => o.level)?.level,
      note: uniq([keep.note ?? '', ...others.map((o) => o.note ?? '')]).join('\n') || undefined,
      tags: cleanTags([...keep.tags, ...others.flatMap((o) => o.tags)]),
      examples: uniq([...(keep.examples ?? []), ...others.flatMap((o) => o.examples ?? [])]),
      createdAt: [keep, ...others].map((v) => v.createdAt).sort()[0],
      updatedAt: now()
    })
    for (const o of others) {
      remap.set(o.id, keep.id)
      removed.add(o.id)
    }
  }
  save(list.filter((v) => !removed.has(v.id)).map((v) => merged.get(v.id) ?? v))
  reviewsFile.update((logs) => logs.map((l) => (remap.has(l.entryId) ? { ...l, entryId: remap.get(l.entryId) as string } : l)))
  return removed.size
}

export function updateVocab(id: string, patch: Partial<VocabEntry>): VocabEntry | null {
  let updated: VocabEntry | null = null
  save(
    all().map((v) => {
      if (v.id !== id) return v
      const { id: _id, srs: _srs, createdAt: _c, ...rest } = patch
      updated = { ...v, ...rest, ...(rest.tags ? { tags: cleanTags(rest.tags) } : {}), updatedAt: now() }
      return updated
    })
  )
  return updated
}

export function removeVocab(ids: string[]): void {
  const set = new Set(ids)
  save(all().filter((v) => !set.has(v.id)))
}

export function moveVocab(ids: string[], deckId: string | null): void {
  const set = new Set(ids)
  save(all().map((v) => (set.has(v.id) ? { ...v, deckId: deckId ?? undefined, updatedAt: now() } : v)))
}

export function tagVocab(ids: string[], add: string[], remove: string[]): void {
  const set = new Set(ids)
  const rm = new Set(cleanTags(remove))
  save(all().map((v) => (set.has(v.id) ? { ...v, tags: cleanTags([...v.tags, ...add]).filter((t) => !rm.has(t)), updatedAt: now() } : v)))
}

export function suspendVocab(ids: string[], suspended: boolean): void {
  const set = new Set(ids)
  save(all().map((v) => (set.has(v.id) ? { ...v, suspended: suspended || undefined, updatedAt: now() } : v)))
}

/** Forgets learning progress: the cards become new again. */
export function resetVocab(ids: string[]): void {
  const set = new Set(ids)
  save(all().map((v) => (set.has(v.id) ? { ...v, srs: newSrs(), updatedAt: now() } : v)))
}

// ───────────── Markdown files (<workbook>/vocabulary/*.md) ─────────────

/** For each file: word key → fingerprint of what the file said last time (to detect edits in the file). */
const fileStateFile = new JsonFile<Record<string, Record<string, string>>>('vocab-files.json', () => ({}), 'workbook')

export interface FileForSync {
  id: string
  title: string
  parsed: ParsedVocabFile
}

/**
 * Imports words from Markdown files without ever creating duplicates:
 * - a new word is added;
 * - a word already in the library (saved from a note, a test, another file…) is not duplicated — the file only
 *   fills in what is missing (translation, sentence, deck, examples, tags);
 * - when a line is edited in the file, the file's values win for the fields it sets; learning progress is kept;
 * - edits made in the app are not overwritten until the line itself changes in the file;
 * - removing a line from a file never deletes the word.
 */
export function syncFromFiles(files: FileForSync[]): { added: number; updated: number; existing: number; changed: string[]; missingTranslation: string[] } {
  const byId = new Map(all().map((v) => [v.id, v]))
  const byKey = new Map([...byId.values()].map((v) => [dedupKey(v.text), v.id]))
  const state = fileStateFile.get()
  const nextState: Record<string, Record<string, string>> = {}
  const deckIds = new Map(listDecks().map((d) => [norm(d.name), d.id]))
  const deckFor = (name?: string): string | undefined => {
    if (!name) return undefined
    let id = deckIds.get(norm(name))
    if (!id) {
      id = createDeck(name).id
      deckIds.set(norm(name), id)
    }
    return id
  }
  let added = 0
  let updated = 0
  let existing = 0
  const changed: string[] = []

  for (const file of files) {
    const prev = state[file.id] ?? {}
    const cur: Record<string, string> = {}
    let touched = false
    for (const item of file.parsed.items) {
      const key = dedupKey(item.text)
      if (!key || cur[key]) continue
      const tags = cleanTags([...file.parsed.tags, ...item.tags])
      const deckId = deckFor(file.parsed.deck)
      const topic = file.parsed.topic
      const fingerprint = JSON.stringify([item.translation, item.context, item.examples, item.note, file.parsed.deck, topic, tags])
      cur[key] = fingerprint
      const id = byKey.get(key)
      const entry = id ? byId.get(id) : undefined

      if (!entry) {
        const created = normalize({
          id: randomUUID(),
          text: item.text,
          translation: item.translation ?? '',
          context: item.context,
          examples: item.examples.length ? item.examples : undefined,
          note: item.note,
          tags,
          deckId,
          topic,
          source: { kind: 'file', title: file.title, ref: file.id },
          createdAt: now()
        })
        byId.set(created.id, created)
        byKey.set(key, created.id)
        added++
        touched = true
      } else if (prev[key] === undefined) {
        // First time this file mentions a word that is already saved: fill gaps only.
        byId.set(entry.id, {
          ...entry,
          translation: entry.translation || item.translation || '',
          context: entry.context ?? item.context,
          examples: uniq([
            ...(entry.examples ?? []),
            ...item.examples,
            ...(entry.context && item.context && dedupKey(item.context) !== dedupKey(entry.context) ? [item.context] : [])
          ]),
          note: entry.note ?? item.note,
          deckId: entry.deckId ?? deckId,
          topic: entry.topic ?? topic,
          tags: cleanTags([...entry.tags, ...tags]),
          updatedAt: now()
        })
        existing++
        touched = true
      } else if (prev[key] !== fingerprint) {
        // The line was edited in the file: the file wins for the fields it sets.
        byId.set(entry.id, {
          ...entry,
          translation: item.translation || entry.translation,
          context: item.context ?? entry.context,
          examples: item.examples.length ? item.examples : entry.examples,
          note: item.note ?? entry.note,
          deckId: deckId ?? entry.deckId,
          topic: topic ?? entry.topic,
          tags: cleanTags([...entry.tags, ...tags]),
          updatedAt: now()
        })
        updated++
        touched = true
      }
    }
    nextState[file.id] = cur
    if (touched) changed.push(file.title)
  }

  if (added || updated || existing) save([...byId.values()])
  fileStateFile.set(nextState)
  const missingTranslation = [...byId.values()].filter((v) => v.source.kind === 'file' && !v.translation).map((v) => v.id)
  return { added, updated, existing, changed, missingTranslation }
}

// ───────────── reviews ─────────────

export function reviewVocab(id: string, grade: SrsGrade, mode: ReviewMode, durationMs?: number): VocabEntry | null {
  const list = all()
  const entry = list.find((v) => v.id === id)
  if (!entry) return null
  const at = new Date()
  const srs = reviewCard(entry.srs, grade, at, getSettings().desiredRetention)
  const updated: VocabEntry = { ...entry, srs }
  save(list.map((v) => (v.id === id ? updated : v)))
  reviewsFile.update((logs) => {
    const next = [...logs, { entryId: id, grade, mode, at: at.toISOString(), prevState: entry.srs.state, ...(durationMs ? { durationMs } : {}) }]
    return next.length > MAX_REVIEW_LOGS ? next.slice(next.length - MAX_REVIEW_LOGS) : next
  })
  return updated
}

export function listReviews(): VocabReviewLog[] {
  return reviewsFile.get()
}

// ───────────── decks ─────────────

export function listDecks(): Deck[] {
  return [...decksFile.get()].sort((a, b) => a.name.localeCompare(b.name))
}

export function createDeck(name: string, color?: string): Deck {
  const decks = decksFile.get()
  const clean = name.trim().slice(0, 60) || 'New deck'
  const existing = decks.find((d) => norm(d.name) === norm(clean))
  if (existing) return existing
  const deck: Deck = { id: randomUUID(), name: clean, color: color ?? DECK_COLORS[decks.length % DECK_COLORS.length], createdAt: now() }
  decksFile.set([...decks, deck])
  return deck
}

export function updateDeck(id: string, patch: Partial<Pick<Deck, 'name' | 'color'>>): void {
  decksFile.update((decks) => decks.map((d) => (d.id === id ? { ...d, ...patch, name: (patch.name ?? d.name).trim().slice(0, 60) || d.name } : d)))
}

/** Deletes the deck; its words stay in the library without a deck. */
export function deleteDeck(id: string): void {
  decksFile.update((decks) => decks.filter((d) => d.id !== id))
  save(all().map((v) => (v.deckId === id ? { ...v, deckId: undefined } : v)))
}

// ───────────── export ─────────────

export function vocabToCsv(list: VocabEntry[]): string {
  const decks = new Map(listDecks().map((d) => [d.id, d.name]))
  const esc = (s: string | undefined): string => `"${(s ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
  const header = ['English', 'Ukrainian', 'Part of speech', 'IPA', 'Level', 'Topic', 'Deck', 'Tags', 'Examples', 'Context', 'Explanation', 'Status', 'Next review', 'Source', 'Added']
  const rows = list.map((v) =>
    [
      v.text,
      v.translation,
      v.pos,
      v.ipa,
      v.level,
      v.topic,
      v.deckId ? decks.get(v.deckId) : '',
      v.tags.join(' '),
      v.examples?.join(' | '),
      v.context,
      v.explanation,
      v.suspended ? 'suspended' : statusOf(v),
      v.srs.state === 0 ? '' : v.srs.due.slice(0, 10),
      v.source.title,
      v.createdAt.slice(0, 10)
    ]
      .map(esc)
      .join(',')
  )
  // BOM so Excel / Numbers detect UTF-8 (Ukrainian letters). Anki can import this file as well.
  return '﻿' + [header.map(esc).join(','), ...rows].join('\r\n') + '\r\n'
}
