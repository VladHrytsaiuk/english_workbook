import type { TestItem } from './types'

function shuffled<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Orders a test session once, at its start:
 * - `questions`: questions in random order; the sub-questions of a reading passage stay together and in order;
 * - `answers`: the options of multiple-choice questions in random order (the right answer is not always in the
 *   same place, whatever order the file lists them in).
 * True / False / Not Given keep their fixed order; order and match questions are always shuffled by their views.
 */
export function arrangeItems(items: TestItem[], opts: { questions: boolean; answers: boolean }, rand: () => number = Math.random): TestItem[] {
  const groups: TestItem[][] = []
  for (const item of items) {
    const last = groups.at(-1)
    if (item.reading && last?.[0].reading?.id === item.reading.id && last[0].testId === item.testId) last.push(item)
    else groups.push([item])
  }
  const ordered = opts.questions ? shuffled(groups, rand).flat() : groups.flat()
  if (!opts.answers) return ordered
  return ordered.map((i) => (i.type === 'choice' ? { ...i, options: shuffled(i.options, rand) } : i))
}
