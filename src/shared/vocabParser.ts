import matter from 'gray-matter'

export { dedupKey } from './dedup'

export interface VocabFileItem {
  text: string
  translation?: string
  /** First `>` line under the word: the sentence it is used in (also used for fill-the-gap practice). */
  context?: string
  /** Further `>` lines or indented `- ` lines. */
  examples: string[]
  tags: string[]
  note?: string
  /** 1-based line in the file. */
  line: number
}

export interface ParsedVocabFile {
  deck?: string
  topic?: string
  tags: string[]
  items: VocabFileItem[]
  issues: { line: number; message: string }[]
}

/** "word — translation": the first separator found wins. */
const SEPARATORS = [' — ', ' – ', ' = ', ' -- ', ' - ', ' | ', '\t', ': ']
const TAG = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu

function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*|__/g, '')
    .replace(/(^|\W)[*_](\S[^*_]*)[*_](?=\W|$)/g, '$1$2')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function takeTags(s: string): { rest: string; tags: string[] } {
  const tags: string[] = []
  const rest = s.replace(TAG, (_m, t: string) => {
    tags.push(t.toLowerCase())
    return ' '
  })
  return { rest: rest.trim(), tags }
}

function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
  if (typeof v === 'string') return v.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
  return []
}

/**
 * Parses a vocabulary Markdown file:
 *
 * ```markdown
 * ---
 * deck: Work
 * tags: [b2]
 * ---
 * - deadline — кінцевий термін #exam
 *   > We have to meet the deadline by Friday.
 *   > The deadline was extended.
 *   note: also "to meet a deadline"
 * - commute
 * ```
 *
 * Top-level list items are words; anything else (headings, paragraphs) is ignored.
 */
export function parseVocabFile(source: string): ParsedVocabFile {
  const text = source.replace(/\r\n?/g, '\n').replace(/^﻿/, '')
  const issues: ParsedVocabFile['issues'] = []
  let data: Record<string, unknown> = {}
  let body = text
  let offset = 0
  try {
    const fm = matter(text)
    data = fm.data ?? {}
    body = fm.content
    if (text.endsWith(body)) offset = text.slice(0, text.length - body.length).split('\n').length - 1
  } catch {
    issues.push({ line: 1, message: 'Frontmatter is not valid YAML, it was ignored.' })
    body = text.replace(/^---\n[\s\S]*?\n---\n?/, '')
  }

  const items: VocabFileItem[] = []
  let current: VocabFileItem | null = null
  let inFence = false

  body.split('\n').forEach((raw, i) => {
    const line = offset + i + 1
    if (/^\s*(```|~~~)/.test(raw)) inFence = !inFence
    if (inFence) return
    const top = raw.match(/^ {0,1}(?:[-*+]|\d+[.)])\s+(.*)$/)
    if (top) {
      const { rest, tags } = takeTags(top[1])
      let word = rest
      let translation: string | undefined
      for (const sep of SEPARATORS) {
        const at = rest.indexOf(sep)
        if (at > 0) {
          word = rest.slice(0, at)
          translation = rest.slice(at + sep.length)
          break
        }
      }
      word = stripMarkdown(word)
      translation = translation ? stripMarkdown(translation) : undefined
      if (!word) {
        issues.push({ line, message: 'Empty list item.' })
        current = null
        return
      }
      if (word.length > 120) issues.push({ line, message: `“${word.slice(0, 30)}…” is very long for a word or phrase.` })
      current = { text: word, translation: translation || undefined, examples: [], tags, line }
      items.push(current)
      return
    }
    if (!current) return
    if (!raw.trim()) return
    const indented = /^(\s{2,}|\t)/.test(raw)
    const quote = raw.match(/^\s*>\s?(.*)$/)
    if (quote && quote[1].trim()) {
      const sentence = stripMarkdown(quote[1])
      if (!current.context) current.context = sentence
      else current.examples.push(sentence)
      return
    }
    if (!indented) {
      current = null // a paragraph or heading ends the item
      return
    }
    const note = raw.match(/^\s+note\s*:\s*(.+)$/i)
    if (note) {
      current.note = stripMarkdown(note[1])
      return
    }
    const sub = raw.match(/^\s+(?:[-*+]|\d+[.)])\s+(.+)$/)
    if (sub) current.examples.push(stripMarkdown(sub[1]))
  })

  return {
    deck: typeof data.deck === 'string' && data.deck.trim() ? data.deck.trim() : undefined,
    topic: typeof data.topic === 'string' && data.topic.trim() ? data.topic.trim() : undefined,
    tags: strList(data.tags),
    items,
    issues
  }
}
