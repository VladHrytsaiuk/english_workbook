import { dedupKey } from './dedup'
import { phraseForms } from './inflect'
import type { VocabEntry } from './types'

/** Correct answers in a row (in tests) after which a word stops being marked as difficult. */
export const TROUBLE_CLEAR_STREAK = 2

/**
 * Updates the "difficult because of test mistakes" mark of a word after one answer in a test:
 * a mistake marks the word (and restarts the count), a correct answer counts towards clearing the mark,
 * and after TROUBLE_CLEAR_STREAK correct answers in a row the mark is gone. This is separate from the spaced-repetition
 * schedule, which tests never change.
 */
export function updateTrouble(prev: VocabEntry['trouble'], correct: boolean, at: string): VocabEntry['trouble'] {
  if (!correct) return { misses: (prev?.misses ?? 0) + 1, streak: 0, lastMissAt: at }
  if (!prev) return undefined
  const streak = prev.streak + 1
  return streak >= TROUBLE_CLEAR_STREAK ? undefined : { ...prev, streak }
}

/**
 * The saved word that a test's `word:` refers to: the same word ignoring case / punctuation / leading "to",
 * otherwise any of its grammatical forms ("giving up" → "to give up").
 */
export function findByWord<T extends { text: string }>(entries: T[], word: string): T | undefined {
  const key = dedupKey(word)
  if (!key) return undefined
  return entries.find((e) => dedupKey(e.text) === key) ?? entries.find((e) => phraseForms(e.text).some((f) => dedupKey(f) === key))
}
