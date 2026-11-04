import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTest } from '@shared/testParser'

// Every example in docs/TEST_FORMAT.md must be valid — that file is given to an AI to generate tests.
const doc = readFileSync(resolve(__dirname, '../docs/TEST_FORMAT.md'), 'utf8')
const blocks = [...doc.matchAll(/```markdown\n([\s\S]*?)\n```/g)].map((m) => m[1])

describe('docs/TEST_FORMAT.md examples', () => {
  it('contains examples', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(10)
  })

  it.each(blocks.map((b, i) => [i, b] as const))('example %i parses without errors or warnings', (_i, block) => {
    const t = parseTest(block, 'example.md')
    expect(t.issues).toEqual([])
    expect(t.items.length).toBeGreaterThan(0)
  })

  it('the complete example covers all 8 types', () => {
    const full = blocks[blocks.length - 1]
    const t = parseTest(full, 'full.md')
    expect(new Set(t.blocks.map((b) => b.type)).size).toBe(8)
  })
})
