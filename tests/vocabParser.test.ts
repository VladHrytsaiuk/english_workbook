import { describe, expect, it } from 'vitest'
import { dedupKey, parseVocabFile } from '@shared/vocabParser'

describe('dedupKey', () => {
  it.each([
    ['To give up', 'give up'],
    ['give  up!', 'give up'],
    ['The deadline', 'deadline'],
    ['an appointment', 'appointment'],
    ['Don’t mind', "don't mind"],
    ['**look forward to**', 'look forward to']
  ])('%s → %s', (a, b) => expect(dedupKey(a)).toBe(dedupKey(b)))

  it('keeps different words apart', () => {
    expect(dedupKey('give up')).not.toBe(dedupKey('give in'))
    expect(dedupKey('a')).toBe('a') // a lone article is a word, not a prefix
  })
})

describe('parseVocabFile', () => {
  const src = `---
deck: Work
tags: [b2, office]
topic: Work
---

# Week 46

Some intro text that is ignored.

- deadline — кінцевий термін #exam
  > We have to meet the deadline by Friday.
  > The deadline was extended.
  note: to meet / miss a deadline
- commute – дорога на роботу
- **reliable** = надійний
- to look forward to - з нетерпінням чекати
  - I look forward to hearing from you.
1. sustainable | сталий
- eventually

## Not a list

- whereas: тоді як
`
  const f = parseVocabFile(src)

  it('reads frontmatter', () => {
    expect(f.deck).toBe('Work')
    expect(f.topic).toBe('Work')
    expect(f.tags).toEqual(['b2', 'office'])
  })

  it('reads every list item with its separator', () => {
    expect(f.items.map((i) => [i.text, i.translation])).toEqual([
      ['deadline', 'кінцевий термін'],
      ['commute', 'дорога на роботу'],
      ['reliable', 'надійний'],
      ['to look forward to', 'з нетерпінням чекати'],
      ['sustainable', 'сталий'],
      ['eventually', undefined],
      ['whereas', 'тоді як']
    ])
  })

  it('collects context, examples, notes, tags and line numbers', () => {
    const d = f.items[0]
    expect(d.context).toBe('We have to meet the deadline by Friday.')
    expect(d.examples).toEqual(['The deadline was extended.'])
    expect(d.note).toBe('to meet / miss a deadline')
    expect(d.tags).toEqual(['exam'])
    expect(d.line).toBe(11)
    expect(f.items[3].examples).toEqual(['I look forward to hearing from you.'])
  })

  it('works without frontmatter and ignores code blocks', () => {
    const g = parseVocabFile('```\n- not a word\n```\n- word — слово\n')
    expect(g.items.map((i) => i.text)).toEqual(['word'])
    expect(g.deck).toBeUndefined()
  })

  it('reports empty items', () => {
    expect(parseVocabFile('- \n-   #tag\n').issues.length).toBeGreaterThan(0)
  })
})

describe('docs/VOCAB_FORMAT.md example', () => {
  it('parses cleanly', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const doc = readFileSync(resolve(__dirname, '../docs/VOCAB_FORMAT.md'), 'utf8')
    const block = doc.match(/```markdown\n([\s\S]*?)\n```/)?.[1] ?? ''
    const f = parseVocabFile(block)
    expect(f.issues).toEqual([])
    expect(f.deck).toBe('Work')
    expect(f.items.map((i) => i.text)).toEqual(['deadline', 'commute', 'to get along with', 'reliable', 'eventually'])
    expect(f.items[2].examples).toEqual(['Do you get along with your boss?'])
    expect(f.items[2].note).toBe('get along WITH somebody')
    expect(f.items[3].tags).toEqual(['adjective'])
  })
})
