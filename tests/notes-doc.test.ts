import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'

// Examples in docs/NOTES_FORMAT.md are copied by users and AI — their frontmatter must be valid.
const doc = readFileSync(resolve(__dirname, '../docs/NOTES_FORMAT.md'), 'utf8')
const blocks = [...doc.matchAll(/```markdown\n([\s\S]*?)\n```/g)].map((m) => m[1])

describe('docs/NOTES_FORMAT.md examples', () => {
  it('has the quick-start and the complete example', () => {
    expect(blocks).toHaveLength(2)
  })
  it.each(blocks.map((b, i) => [i, b] as const))('example %i has a title, tags and a table', (_i, block) => {
    const fm = matter(block)
    expect(typeof fm.data.title).toBe('string')
    expect(Array.isArray(fm.data.tags)).toBe(true)
    expect(fm.content).toMatch(/^\|.+\|\n\|[-| ]+\|$/m)
  })
})
