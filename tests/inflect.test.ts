import { describe, expect, it } from 'vitest'
import { inflections, phraseForms } from '@shared/inflect'

describe('inflections', () => {
  it.each([
    ['give', ['gives', 'gave', 'given', 'giving']],
    ['go', ['goes', 'went', 'gone', 'going']],
    ['stop', ['stops', 'stopped', 'stopping']],
    ['study', ['studies', 'studied', 'studying']],
    ['make', ['makes', 'made', 'making']],
    ['die', ['dies', 'died', 'dying']],
    ['play', ['plays', 'played', 'playing']],
    ['watch', ['watches', 'watched', 'watching']],
    ['plan', ['plans', 'planned', 'planning']]
  ])('%s', (word, expected) => {
    const forms = inflections(word)
    expect(forms).toContain(word)
    for (const f of expected) expect(forms, f).toContain(f)
  })
})

describe('phraseForms', () => {
  it('inflects the verb of a phrasal verb', () => {
    expect(phraseForms('give up')).toEqual(expect.arrayContaining(['give up', 'gave up', 'giving up', 'given up', 'gives up']))
    expect(phraseForms('to look forward to')).toEqual(expect.arrayContaining(['looking forward to', 'looked forward to']))
  })
  it('pluralises the last word of a noun phrase and drops the leading "to" / article', () => {
    expect(phraseForms('the dentist appointment')).toEqual(expect.arrayContaining(['dentist appointments']))
  })
  it('handles empty input', () => {
    expect(phraseForms('  ')).toEqual([])
  })
})
