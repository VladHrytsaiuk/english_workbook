import { dedupKey } from './dedup'
import { isDifficult, makeCloze, statusOf } from './srs'
import type { SimpleQuestion, TestItem, VocabEntry } from './types'

// Tests built from the learner's own vocabulary. They use the normal test engine (results, mistakes bank,
// topic breakdown) but never touch the spaced-repetition schedule: this is a check, not a review.

export type WordKind = 'translate' | 'reverse' | 'typing' | 'cloze' | 'order' | 'match'

export const WORD_KINDS: { id: WordKind; label: string; hint: string }[] = [
  { id: 'translate', label: 'Choose the translation', hint: 'English word → 4 translations' },
  { id: 'reverse', label: 'Choose the English word', hint: 'Translation → 4 English words' },
  { id: 'typing', label: 'Write it in English', hint: 'Type the word from its translation' },
  { id: 'cloze', label: 'Fill the gap', hint: 'In the sentence where you found the word' },
  { id: 'order', label: 'Build the sentence', hint: 'Put the words of an example in order' },
  { id: 'match', label: 'Match pairs', hint: 'One round of 5 words per 8 words' }
]

export type WordSource = 'week' | 'studying' | 'difficult' | 'all'

export const WORD_SOURCE_LABEL: Record<WordSource, string> = {
  week: 'Added this week',
  studying: 'Not mastered yet',
  difficult: 'Difficult words',
  all: 'All words'
}

const DAY = 86_400_000
export const MIN_WORDS_FOR_TEST = 4

/** Words that can be asked: not suspended, with a translation. */
export const isTestable = (e: VocabEntry): boolean => !e.suspended && Boolean(e.text.trim()) && Boolean(e.translation.trim())

export function filterBySource(entries: VocabEntry[], source: WordSource, now = new Date()): VocabEntry[] {
  const ok = entries.filter(isTestable)
  switch (source) {
    case 'week':
      return ok.filter((e) => new Date(e.createdAt).getTime() >= now.getTime() - 7 * DAY)
    case 'studying':
      return ok.filter((e) => statusOf(e) !== 'mastered')
    case 'difficult':
      return ok.filter(isDifficult)
    case 'all':
      return ok
  }
}

// ───────────── helpers ─────────────

type Rand = () => number

function shuffle<T>(arr: readonly T[], rand: Rand): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Weighted order without replacement (Efraimidis–Spirakis): heavier items tend to come first. */
function weightedOrder<T>(items: readonly T[], weight: (t: T) => number, rand: Rand): T[] {
  return items
    .map((item) => ({ item, key: Math.pow(Math.max(rand(), 1e-9), 1 / Math.max(weight(item), 0.01)) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.item)
}

const uniq = (list: string[]): string[] => [...new Map(list.map((x) => x.trim()).filter(Boolean).map((x) => [x.toLowerCase(), x])).values()]

/** Sentences that contain the word, then the other sentences saved with it. */
function sentences(e: VocabEntry): string[] {
  return uniq([e.context ?? '', ...(e.examples ?? [])])
}

function pickOptions(e: VocabEntry, pool: VocabEntry[], field: 'translation' | 'text', rand: Rand): string[] | null {
  const key = (s: string): string => (field === 'text' ? dedupKey(s) : s.trim().toLowerCase().replace(/\s+/g, ' '))
  const seen = new Set([key(e[field])])
  const same: string[] = []
  const other: string[] = []
  for (const p of shuffle(pool, rand)) {
    if (p.id === e.id) continue
    const k = key(p[field])
    if (!k || seen.has(k)) continue
    seen.add(k)
    ;(p.pos && p.pos === e.pos ? same : other).push(p[field].trim())
  }
  const picks = [...same, ...other].slice(0, 3)
  return picks.length === 3 ? shuffle([e[field].trim(), ...picks], rand) : null
}

function hintFor(text: string): string {
  const words = text.trim().split(/\s+/)
  const first = text.trim()[0]
  return words.length > 1 ? `${words.length} words · starts with “${first}”` : `${text.trim().length} letters · starts with “${first}”`
}

function explainFor(e: VocabEntry): string {
  const meta = [e.pos, e.ipa, e.level].filter(Boolean).join(' · ')
  const parts = [`**${e.text}** — ${e.translation}${meta ? `  \n${meta}` : ''}`]
  if (e.context) parts.push(`*${e.context}*`)
  const more = (e.examples ?? []).filter((x) => x !== e.context).slice(0, 2)
  if (more.length) parts.push(more.map((x) => `- ${x}`).join('\n'))
  if (e.note) parts.push(`📝 ${e.note}`)
  return parts.join('\n\n')
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type Draft = DistributiveOmit<SimpleQuestion, 'id' | 'explain' | 'hint' | 'topics' | 'line'> & { hint?: string }

function buildOne(e: VocabEntry, kind: Exclude<WordKind, 'match'>, pool: VocabEntry[], rand: Rand): Draft | null {
  const text = e.text.trim()
  const translation = e.translation.trim()
  const pos = e.pos ? ` *(${e.pos})*` : ''
  switch (kind) {
    case 'translate': {
      const options = pickOptions(e, pool, 'translation', rand)
      return options ? { type: 'choice', prompt: `What does **${text}** mean?${pos}`, options, answer: translation } : null
    }
    case 'reverse': {
      const options = pickOptions(e, pool, 'text', rand)
      return options ? { type: 'choice', prompt: `Choose the English word for: **${translation}**${pos}`, options, answer: text } : null
    }
    case 'typing': {
      const bare = text.replace(/^to\s+/i, '')
      const answers = uniq([text, bare, ...(/verb/.test(e.pos ?? '') && !/^to\s/i.test(text) ? [`to ${text}`] : [])])
      return { type: 'gap', prompt: `Write in English: **${translation}**${pos}`, answers, hint: hintFor(text) }
    }
    case 'cloze': {
      for (const s of sentences(e)) {
        const c = makeCloze(s, text)
        if (!c) continue
        const form = s.slice(c.before.length, s.length - c.after.length)
        const answers = uniq([form, text, text.replace(/^to\s+/i, '')])
        return { type: 'gap', prompt: `${c.before}___${c.after}  *(= ${translation})*`, answers, hint: hintFor(form) }
      }
      return null
    }
    case 'order': {
      const usable = sentences(e)
        .filter((s) => {
          const n = s.split(/\s+/).length
          return n >= 4 && n <= 12
        })
        .sort((a, b) => Number(Boolean(makeCloze(b, text))) - Number(Boolean(makeCloze(a, text))))
      const s = usable[0]
      if (!s) return null
      return { type: 'order', prompt: `Put the words in order — the sentence uses **${text}** (${translation}).`, chunks: s.split(/\s+/), answers: [s] }
    }
  }
}

export interface WordTestOptions {
  /** Number of words to ask about (a matching round is added per 8 words). */
  count: number
  kinds: WordKind[]
  rand?: Rand
  /** Name of a deck, used to group results by topic. */
  deckName?: (deckId: string) => string | undefined
  title?: string
}

/** Kind weights: recognition first for new words, recall for words you already know. */
function kindWeight(e: VocabEntry, kind: WordKind): number {
  const isNew = statusOf(e) === 'new'
  const w: Record<Exclude<WordKind, 'match'>, [number, number]> = {
    translate: [3, 1],
    reverse: [2, 1],
    cloze: [1.5, 3],
    typing: [0.5, 2],
    order: [0.5, 1]
  }
  return (w[kind as Exclude<WordKind, 'match'>] ?? [1, 1])[isNew ? 0 : 1]
}

/**
 * Builds a test from `selected` words (distractors come from the whole `pool`). Each word gets one question of a
 * suitable kind (a kind is skipped when it can't be built, e.g. no saved sentence for a gap); with "match" enabled
 * one round of 5 words is added per 8 words. Returns questions in random order.
 */
export function buildWordTest(selected: VocabEntry[], pool: VocabEntry[], opts: WordTestOptions): TestItem[] {
  const rand = opts.rand ?? Math.random
  const testableSelected = selected.filter(isTestable)
  const testablePool = pool.filter(isTestable)
  const kinds = opts.kinds.filter((k): k is Exclude<WordKind, 'match'> => k !== 'match')
  const title = opts.title ?? 'Word test'
  const groupOf = (e: VocabEntry): string => e.topic || (e.deckId && opts.deckName?.(e.deckId)) || 'General'

  // Harder words first when there are more candidates than questions.
  const order = weightedOrder(testableSelected, (e) => 1 + e.srs.lapses * 2 + (isDifficult(e) ? 1 : 0), rand)
  const built: { entry: VocabEntry; q: Draft; kind: WordKind }[] = []
  let last: WordKind | null = null
  for (const e of order) {
    if (built.length >= opts.count) break
    const tries = weightedOrder(kinds, (k) => kindWeight(e, k) * (k === last ? 0.25 : 1), rand)
    for (const kind of tries) {
      const q = buildOne(e, kind, testablePool, rand)
      if (q) {
        built.push({ entry: e, q, kind })
        last = kind
        break
      }
    }
  }

  const items: Omit<TestItem, 'id'>[] = built.map(({ entry, q, kind }) => ({
    ...(q as SimpleQuestion),
    explain: explainFor(entry),
    topics: [`Vocabulary · ${groupOf(entry)}`],
    line: 0,
    key: `words#${entry.id}:${kind}`,
    testId: 'words',
    testTitle: title
  })) as Omit<TestItem, 'id'>[]

  // Matching rounds
  if (opts.kinds.includes('match')) {
    const rounds = Math.floor(built.length / 8)
    const used = new Set<string>()
    for (let r = 0; r < rounds; r++) {
      const fresh = shuffle(built.map((b) => b.entry).filter((e) => !used.has(e.id)), rand)
      const seenTr = new Set<string>()
      const seenTx = new Set<string>()
      const group: VocabEntry[] = []
      for (const e of fresh) {
        const tr = e.translation.trim().toLowerCase()
        const tx = dedupKey(e.text)
        if (seenTr.has(tr) || seenTx.has(tx)) continue
        seenTr.add(tr)
        seenTx.add(tx)
        group.push(e)
        if (group.length === 5) break
      }
      if (group.length < 3) break
      group.forEach((e) => used.add(e.id))
      items.push({
        type: 'match',
        prompt: 'Match the words with their translations.',
        pairs: group.map((e) => ({ left: e.text.trim(), right: e.translation.trim() })),
        explain: group.map((e) => `- **${e.text}** — ${e.translation}`).join('\n'),
        topics: ['Vocabulary · Matching'],
        line: 0,
        key: `words#match:${group.map((e) => e.id.slice(0, 6)).sort().join('')}`,
        testId: 'words',
        testTitle: title
      } as Omit<TestItem, 'id'>)
    }
  }

  return shuffle(items, rand).map((it, i) => ({ ...it, id: `W${i + 1}` }) as TestItem)
}

// ───────────── prompt for an external AI chat ─────────────

/**
 * A ready-to-paste prompt: the learner's words (with translations and the sentences they were found in)
 * plus the full test format spec, so a chat that knows nothing about the app writes a valid test file.
 */
export function wordTestPrompt(words: VocabEntry[], spec: string, today = new Date()): string {
  const list = words
    .map((w, i) => {
      const bits = [`${i + 1}. ${w.text.trim()} — ${w.translation.trim()}`]
      if (w.pos) bits.push(`[${w.pos}]`)
      if (w.context) bits.push(`— seen in: “${w.context}”`)
      return bits.join(' ')
    })
    .join('\n')
  const date = today.toISOString().slice(0, 10)
  return `Create a vocabulary test for a Ukrainian-speaking learner of English (level B1–B2), in EXACTLY the Markdown format described in the spec at the end of this message.

The test must check ONLY these ${words.length} words — the learner's own list (word — Ukrainian translation, part of speech, the sentence where the learner met it):

${list}

Requirements:
- At least one question per word, using different question types: choice (4 plausible options), gap (type the missing word), transform or error where it fits, plus 1–2 match blocks (5 pairs each), and one short reading block if the words allow it.
- Write NEW example sentences. Do not reuse the "seen in" sentences — the test must check understanding, not memory of those sentences.
- Distractors in choice questions must be real words of the same kind; move the correct answer around (not always in the same place). Every choice answer must be copied exactly from its options.
- Frontmatter: title "Vocabulary — ${date}", topics: [Vocabulary]. Put "topic: Vocabulary" on every question.
- explain: one short sentence in simple English with the Ukrainian translation in brackets.
- Output ONLY the content of the Markdown file, with no comments before or after it.

===== TEST FORMAT SPEC =====

${spec.trim()}
`
}

export const ALL_KINDS_FOR_TEST: WordKind[] = WORD_KINDS.map((k) => k.id)
