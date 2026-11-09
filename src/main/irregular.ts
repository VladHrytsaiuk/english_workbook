import { VERBS } from '@shared/irregular'
import { newSrs, reviewCard } from '@shared/srs'
import type { IrregularProgress, SrsGrade } from '@shared/types'
import { getSettings } from './data'
import { JsonFile } from './storage'

const file = new JsonFile<IrregularProgress>('irregular.json', () => ({}), 'workbook')

export const irregularProgress = (): IrregularProgress => file.get()

/** Records one answer for a verb with FSRS and returns its new card. Unknown ids are ignored. */
export function reviewIrregular(id: string, grade: SrsGrade): IrregularProgress[string] | null {
  if (!VERBS.some((v) => v.id === id)) return null
  const at = new Date()
  const card = reviewCard(file.get()[id] ?? newSrs(at), grade, at, getSettings().desiredRetention)
  file.update((all) => ({ ...all, [id]: card }))
  return card
}

export const resetIrregular = (ids?: string[]): void => {
  file.update((all) => (ids ? Object.fromEntries(Object.entries(all).filter(([k]) => !ids.includes(k))) : {}))
}
