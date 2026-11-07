import { modKey } from './utils'

/** Keyboard shortcuts shown in Help and Settings. */
export const SHORTCUTS: [keys: string, what: string][] = [
  [`${modKey} 1 – ${modKey} 6`, 'Today, Notes, Tests, Vocabulary, Writing, Stats'],
  [`${modKey} ,`, 'Settings'],
  [`${modKey} F  or  /`, 'Search notes / vocabulary'],
  [`${modKey} N`, 'Add a word (vocabulary)'],
  ['↵', 'Start test · check answer · next question'],
  ['1 – 9', 'Pick an option, chunk or match'],
  ['T  F  N', 'True / False / Not Given'],
  ['← →', 'Previous / next question'],
  ['H', 'Show hint'],
  ['R', 'Retry mistakes (results) · start review (vocabulary)'],
  ['Space', 'Show the answer of a flashcard'],
  ['1  2  3  4', 'Again · Hard · Good · Easy (review)'],
  ['S', 'Play the word (review)'],
  ['Esc', 'Exit test or review · close popover']
]
