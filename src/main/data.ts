import type { Attempt, MistakeEntry, Settings, TestItem } from '@shared/types'
import { JsonFile } from './storage'

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5'
export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite'

const DEFAULT_SETTINGS: Settings = {
  contentDir: null,
  theme: 'system',
  provider: 'gemini',
  claudeModel: DEFAULT_CLAUDE_MODEL,
  geminiModel: DEFAULT_GEMINI_MODEL,
  autoTranslate: true,
  shuffleQuestions: true,
  shuffleAnswers: true,
  showTopics: false,
  desiredRetention: 0.9,
  newCardsPerDay: 20,
  reviewsPerDay: 200,
  reviewMode: 'mixed',
  defaultDeckId: null,
  speakWords: true,
  voiceName: null,
  tourDone: false
}

const settingsFile = new JsonFile<Settings>('settings.json', () => ({ ...DEFAULT_SETTINGS }))
const attemptsFile = new JsonFile<Attempt[]>('attempts.json', () => [], 'workbook')
const mistakesFile = new JsonFile<Record<string, MistakeEntry>>('mistakes.json', () => ({}), 'workbook')

/** A question leaves the mistakes bank after this many correct answers in a row. */
export const MASTERY_STREAK = 2

// ───────────── settings ─────────────

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...settingsFile.get() }
}

export function updateSettings(patch: Partial<Settings>): Settings {
  return settingsFile.update((s) => ({ ...DEFAULT_SETTINGS, ...s, ...patch }))
}

// ───────────── attempts + mistakes bank ─────────────

export function listAttempts(): Attempt[] {
  return attemptsFile.get()
}

/**
 * Saves an attempt and updates the mistakes bank:
 * - wrong answer → the question enters the bank (or its streak resets to 0)
 * - correct answer for a banked question → streak + 1; at MASTERY_STREAK it leaves the bank
 */
export function saveAttempt(attempt: Attempt, items: TestItem[]): Attempt {
  attemptsFile.update((list) => [...list.filter((a) => a.id !== attempt.id), attempt])
  const byKey = new Map(items.map((i) => [i.key, i]))
  mistakesFile.update((bank) => {
    const next = { ...bank }
    for (const r of attempt.results) {
      const existing = next[r.key]
      if (!r.correct) {
        const item = byKey.get(r.key) ?? existing?.item
        if (!item) continue
        next[r.key] = {
          key: r.key,
          item,
          streak: 0,
          wrongCount: (existing?.wrongCount ?? 0) + 1,
          lastWrongAt: attempt.finishedAt,
          lastSeenAt: attempt.finishedAt
        }
      } else if (existing) {
        const streak = existing.streak + 1
        if (streak >= MASTERY_STREAK) delete next[r.key]
        else next[r.key] = { ...existing, streak, lastSeenAt: attempt.finishedAt, item: byKey.get(r.key) ?? existing.item }
      }
    }
    return next
  })
  return attempt
}

export function deleteAttempt(id: string): void {
  attemptsFile.update((list) => list.filter((a) => a.id !== id))
}

export function listMistakes(): MistakeEntry[] {
  return Object.values(mistakesFile.get()).sort((a, b) => b.lastWrongAt.localeCompare(a.lastWrongAt))
}

export function removeMistake(key: string): void {
  mistakesFile.update((bank) => {
    const next = { ...bank }
    delete next[key]
    return next
  })
}

export function clearProgress(): void {
  attemptsFile.set([])
  mistakesFile.set({})
}
