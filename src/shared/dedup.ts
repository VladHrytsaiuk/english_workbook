import { normalizeAnswer } from './answer'

/**
 * The key used to detect duplicate words: case, spacing, curly vs straight apostrophes, punctuation and a
 * leading "to" / article are ignored, so "To give up", "give up!" and "give  up" are the same word.
 */
export function dedupKey(text: string): string {
  return normalizeAnswer(text)
    .replace(/[“”"«»()[\]{}*_`~]/g, '')
    .replace(/[.,;:!?…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(to|a|an|the)\s+(?=\S)/, '')
}
