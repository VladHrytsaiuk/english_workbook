import { describe, expect, it } from 'vitest'
import { isDifficult, newSrs } from '@shared/srs'
import { TROUBLE_CLEAR_STREAK, findByWord, updateTrouble } from '@shared/trouble'

const at = '2026-11-08T10:00:00.000Z'

describe('updateTrouble', () => {
  it('a mistake marks the word and counts mistakes', () => {
    const a = updateTrouble(undefined, false, at)
    expect(a).toEqual({ misses: 1, streak: 0, lastMissAt: at })
    expect(updateTrouble(a, false, at)).toEqual({ misses: 2, streak: 0, lastMissAt: at })
  })
  it('a correct answer for an unmarked word changes nothing', () => {
    expect(updateTrouble(undefined, true, at)).toBeUndefined()
  })
  it('clears after correct answers in a row, and a mistake restarts the count', () => {
    expect(TROUBLE_CLEAR_STREAK).toBe(2)
    let t = updateTrouble(undefined, false, at)
    t = updateTrouble(t, true, at)
    expect(t).toMatchObject({ misses: 1, streak: 1 })
    t = updateTrouble(t, false, at)
    expect(t).toMatchObject({ misses: 2, streak: 0 })
    t = updateTrouble(t, true, at)
    t = updateTrouble(t, true, at)
    expect(t).toBeUndefined()
  })
  it('a marked word counts as difficult', () => {
    const srs = newSrs()
    expect(isDifficult({ srs })).toBe(false)
    expect(isDifficult({ srs, trouble: { misses: 1, streak: 0, lastMissAt: at } })).toBe(true)
  })
})

describe('findByWord', () => {
  const entries = [{ text: 'to give up' }, { text: 'deadline' }, { text: 'look forward to' }]
  it('matches the same word ignoring case, punctuation and a leading "to"', () => {
    expect(findByWord(entries, 'Give up!')?.text).toBe('to give up')
    expect(findByWord(entries, 'the deadline')?.text).toBe('deadline')
  })
  it('matches a grammatical form of the saved word', () => {
    expect(findByWord(entries, 'giving up')?.text).toBe('to give up')
    expect(findByWord(entries, 'gave up')?.text).toBe('to give up')
    expect(findByWord(entries, 'deadlines')?.text).toBe('deadline')
  })
  it('prefers an exact match and returns nothing for unknown or empty words', () => {
    expect(findByWord([{ text: 'giving up' }, { text: 'give up' }], 'giving up')?.text).toBe('giving up')
    expect(findByWord(entries, 'banana')).toBeUndefined()
    expect(findByWord(entries, '  ')).toBeUndefined()
  })
})
