import { describe, expect, it } from 'vitest'
import { checkTyped, formatInterval, isDue, makeCloze, newSrs, previewDue, reviewCard, statusOf, suggestedGrade } from '@shared/srs'

const now = new Date('2026-11-04T10:00:00Z')

describe('FSRS scheduling', () => {
  it('a new card is new and not due', () => {
    const srs = newSrs(now)
    expect(statusOf({ srs })).toBe('new')
    expect(isDue({ srs }, now)).toBe(false)
  })

  it('better grades schedule further in the future', () => {
    const p = previewDue(newSrs(now), now, 0.9)
    expect(p[1].getTime()).toBeLessThanOrEqual(p[2].getTime())
    expect(p[2].getTime()).toBeLessThanOrEqual(p[3].getTime())
    expect(p[3].getTime()).toBeLessThan(p[4].getTime())
  })

  it('Again on a review card sends it back to relearning with a lapse', () => {
    let srs = reviewCard(newSrs(now), 4, now, 0.9) // Easy → review
    expect(srs.state).toBe(2)
    const later = new Date(srs.due)
    srs = reviewCard(srs, 1, later, 0.9)
    expect(srs.state).toBe(3)
    expect(srs.lapses).toBe(1)
    expect(statusOf({ srs })).toBe('learning')
  })

  it('repeated Good answers grow the interval until the card is mastered', () => {
    let srs = newSrs(now)
    let t = now
    for (let i = 0; i < 8; i++) {
      srs = reviewCard(srs, 3, t, 0.9)
      t = new Date(srs.due)
    }
    expect(srs.stability).toBeGreaterThan(21)
    expect(statusOf({ srs })).toBe('mastered')
  })

  it('higher desired retention means shorter intervals', () => {
    const base = reviewCard(newSrs(now), 4, now, 0.9)
    const at = new Date(base.due)
    const strict = previewDue(base, at, 0.97)[3].getTime()
    const relaxed = previewDue(base, at, 0.8)[3].getTime()
    expect(strict).toBeLessThan(relaxed)
  })

  it('suspended cards are never due', () => {
    const srs = reviewCard(newSrs(now), 1, now, 0.9)
    expect(isDue({ srs, suspended: true }, new Date(now.getTime() + 864e5))).toBe(false)
    expect(isDue({ srs }, new Date(now.getTime() + 864e5))).toBe(true)
  })
})

describe('formatInterval', () => {
  it.each([
    [5, '5m'],
    [90, '2h'],
    [60 * 24 * 3, '3d'],
    [60 * 24 * 90, '3mo'],
    [60 * 24 * 365 * 2, '2y']
  ])('%i minutes → %s', (m, out) => expect(formatInterval(now, new Date(now.getTime() + m * 60000))).toBe(out))
})

describe('checkTyped', () => {
  it('ignores case, spaces, apostrophes and an optional "to"', () => {
    expect(checkTyped('  Look Forward To ', 'look forward to')).toBe('correct')
    expect(checkTyped('give up', 'to give up')).toBe('correct')
    expect(checkTyped('don’t mind', "don't mind")).toBe('correct')
  })
  it('treats a one-letter slip as a typo', () => {
    expect(checkTyped('recieve', 'receive')).toBe('typo') // swapped letters
    expect(checkTyped('recive', 'receive')).toBe('typo') // missing letter
    expect(checkTyped('look forwrd too', 'look forward to')).toBe('typo') // two slips in a long phrase
    expect(suggestedGrade('typo')).toBe(2)
  })
  it('rejects different words', () => {
    expect(checkTyped('take', 'make')).toBe('wrong') // short words must be exact
    expect(checkTyped('recieved', 'receive')).toBe('wrong')
    expect(checkTyped('bring', 'take')).toBe('wrong')
    expect(checkTyped('', 'take')).toBe('wrong')
  })
})

describe('makeCloze', () => {
  it('blanks the word in its sentence, case-insensitively', () => {
    expect(makeCloze('The museum was Renovated last year.', 'renovated')).toEqual({ before: 'The museum was ', after: ' last year.' })
  })
  it('matches multi-word phrases across extra spaces', () => {
    expect(makeCloze('I really look  forward to it.', 'look forward to')).toEqual({ before: 'I really ', after: ' it.' })
  })
  it('does not match inside other words', () => {
    expect(makeCloze('The carpet is red.', 'pet')).toBeNull()
  })
  it('finds a saved verb phrase or noun without its leading "to" / article', () => {
    expect(makeCloze("Don't give up on your dreams.", 'to give up')).toEqual({ before: "Don't ", after: ' on your dreams.' })
    expect(makeCloze('We met the deadline.', 'the deadline')).toEqual({ before: 'We met ', after: '.' }) // full form found
    expect(makeCloze('We met a deadline.', 'the deadline')).toEqual({ before: 'We met a ', after: '.' }) // only the bare word is there
    expect(makeCloze('I want to give up.', 'to give up')).toEqual({ before: 'I want ', after: '.' }) // the full form still wins
  })
  it('returns null without context', () => {
    expect(makeCloze(undefined, 'word')).toBeNull()
  })
})
