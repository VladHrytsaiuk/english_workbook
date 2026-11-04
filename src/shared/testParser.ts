import matter from 'gray-matter'
import { load } from 'js-yaml'
import { normalizeAnswer, normalizeTf, splitAlternatives } from './answer'
import type {
  ChoiceQuestion,
  MatchQuestion,
  OrderQuestion,
  ParseIssue,
  ParsedTest,
  ReadingBlock,
  SimpleQuestion,
  SimpleQuestionType,
  TestItem,
  TextQuestion,
  TfQuestion
} from './types'

export const SIMPLE_TYPES: SimpleQuestionType[] = ['choice', 'gap', 'transform', 'error', 'order', 'match', 'tf']

/** Keys whose single-line value is always free text (quoted verbatim before YAML parsing). */
const FREE_TEXT_KEYS = new Set([
  'q',
  'question',
  'answer',
  'explain',
  'explanation',
  'hint',
  'title',
  'topic'
])

const KEY_ALIASES: Record<string, string> = {
  question: 'q',
  explanation: 'explain',
  choices: 'options',
  words: 'chunks',
  parts: 'chunks',
  answers: 'answer',
  topics: 'topic',
  text: 'passage',
  ng: 'notgiven',
  not_given: 'notgiven',
  'not-given': 'notgiven'
}

const BASE_KEYS = ['type', 'q', 'explain', 'hint', 'topic']
const ALLOWED_KEYS: Record<string, string[]> = {
  choice: [...BASE_KEYS, 'options', 'answer'],
  gap: [...BASE_KEYS, 'answer'],
  transform: [...BASE_KEYS, 'answer'],
  error: [...BASE_KEYS, 'answer'],
  order: [...BASE_KEYS, 'chunks', 'answer'],
  match: [...BASE_KEYS, 'pairs'],
  tf: [...BASE_KEYS, 'answer', 'notgiven'],
  reading: ['type', 'title', 'passage', 'questions', 'topic']
}

/**
 * Makes the format forgiving: single-line values of free-text keys (`q:`, `answer:`, `explain:`…)
 * are wrapped in quotes so colons, `#`, leading `*` etc. inside sentences don't break YAML.
 * Block scalars (`|`, `>`) are skipped together with their content. The line count is preserved.
 */
export function quoteFreeTextValues(body: string): string {
  const lines = body.split('\n')
  let blockKeyColumn = -1
  const keyLine = /^(\s*(?:-\s+)?)([A-Za-z_][\w-]*)(\s*):[ \t]+(.*?)\s*$/

  return lines
    .map((line) => {
      if (blockKeyColumn >= 0) {
        const indent = line.match(/^ */)?.[0].length ?? 0
        if (line.trim() === '' || indent > blockKeyColumn) return line
        blockKeyColumn = -1
      }
      const m = line.match(keyLine)
      if (!m) return line
      const [, prefix, key, , value] = m
      if (/^[|>][-+0-9]*$/.test(value)) {
        blockKeyColumn = prefix.length
        return line
      }
      if (!FREE_TEXT_KEYS.has(key.toLowerCase()) || value === '') return line
      const wrapped =
        (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
        (value.startsWith("'") && value.endsWith("'") && value.length > 1) ||
        (value.startsWith('[') && value.endsWith(']')) ||
        (value.startsWith('{') && value.endsWith('}'))
      if (wrapped) return line
      return `${prefix}${key}: ${JSON.stringify(value)}`
    })
    .join('\n')
}

// ───────────────────────── helpers ─────────────────────────

type Raw = Record<string, unknown>

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return undefined
}

function strList(v: unknown, splitter: RegExp | string = ','): string[] {
  if (Array.isArray(v)) return v.map((x) => str(x) ?? '').filter(Boolean)
  const s = str(v)
  if (!s) return []
  return s
    .split(splitter)
    .map((x) => x.trim())
    .filter(Boolean)
}

function normalizeKeys(raw: Raw): Raw {
  const out: Raw = {}
  for (const [k, v] of Object.entries(raw)) {
    const lower = k.trim().toLowerCase()
    out[KEY_ALIASES[lower] ?? lower] = v
  }
  return out
}

function words(s: string): string[] {
  return normalizeAnswer(s)
    .replace(/[^\p{L}\p{N}'\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
}

interface Ctx {
  issues: ParseIssue[]
  testTopics: string[]
}

function issue(ctx: Ctx, severity: ParseIssue['severity'], questionId: string, line: number, message: string): void {
  ctx.issues.push({ severity, questionId, line, message })
}

// ───────────────────────── question builders ─────────────────────────

function buildSimple(raw: Raw, id: string, line: number, ctx: Ctx, inheritedTopics: string[]): SimpleQuestion | null {
  const r = normalizeKeys(raw)
  const type = str(r.type)?.toLowerCase()
  const err = (msg: string): null => {
    issue(ctx, 'error', id, line, msg)
    return null
  }
  if (!type) return err('Missing `type:`. Use one of: ' + [...SIMPLE_TYPES, 'reading'].join(', ') + '.')
  if (type === 'reading') return err('A reading block cannot contain another reading block.')
  if (!SIMPLE_TYPES.includes(type as SimpleQuestionType))
    return err(`Unknown type \`${type}\`. Use one of: ${[...SIMPLE_TYPES, 'reading'].join(', ')}.`)

  for (const k of Object.keys(r)) {
    if (!ALLOWED_KEYS[type].includes(k)) issue(ctx, 'warning', id, line, `Unknown key \`${k}:\` is ignored (typo?).`)
  }

  const topicsOwn = strList(r.topic)
  const base = {
    id,
    line,
    prompt: str(r.q) ?? '',
    explain: str(r.explain) || undefined,
    hint: str(r.hint) || undefined,
    topics: topicsOwn.length ? topicsOwn : inheritedTopics
  }

  switch (type as SimpleQuestionType) {
    case 'choice': {
      if (!base.prompt) return err('Missing `q:` (the question text).')
      const options = Array.isArray(r.options) ? strList(r.options) : strList(r.options, '|')
      if (options.length < 2) return err('`options:` needs at least 2 options, e.g. `options: [a, b, c]`.')
      if (new Set(options).size !== options.length) return err('`options:` contains duplicates.')
      const rawAnswer = str(r.answer)
      if (!rawAnswer) return err('Missing `answer:` (must be one of the options).')
      let answer = options.find((o) => o === rawAnswer) ?? options.find((o) => normalizeAnswer(o) === normalizeAnswer(rawAnswer))
      if (!answer && /^[a-h]$/i.test(rawAnswer)) answer = options[rawAnswer.toLowerCase().charCodeAt(0) - 97]
      if (!answer && /^\d+$/.test(rawAnswer)) answer = options[Number(rawAnswer) - 1]
      if (!answer) return err(`\`answer: ${rawAnswer}\` is not one of the options [${options.join(', ')}].`)
      return { ...base, type: 'choice', options, answer } satisfies ChoiceQuestion
    }
    case 'gap':
    case 'transform':
    case 'error': {
      if (!base.prompt) return err('Missing `q:` (the question text).')
      const answers = Array.isArray(r.answer) ? strList(r.answer) : splitAlternatives(str(r.answer) ?? '')
      if (!answers.length) return err('Missing `answer:`. Separate several accepted answers with `|`.')
      if (type === 'gap' && !/_{2,}/.test(base.prompt))
        issue(ctx, 'warning', id, line, 'Gap question has no `___` placeholder in `q:`.')
      return { ...base, type: type as TextQuestion['type'], answers } satisfies TextQuestion
    }
    case 'order': {
      let chunks = Array.isArray(r.chunks) ? strList(r.chunks) : strList(r.chunks, '/')
      const rawAnswer = Array.isArray(r.answer) ? strList(r.answer).join(' | ') : str(r.answer) ?? ''
      let answers: string[]
      if (!chunks.length && rawAnswer.includes('/')) {
        chunks = strList(rawAnswer, '/')
        answers = [chunks.join(' ')]
      } else {
        answers = splitAlternatives(rawAnswer)
      }
      if (chunks.length < 2) return err('`chunks:` needs at least 2 items, e.g. `chunks: [I, have never been, to Paris]`.')
      if (!answers.length) answers = [chunks.join(' ')]
      const want = words(chunks.join(' ')).join(' ')
      answers.forEach((a) => {
        if (words(a).join(' ') !== want)
          issue(ctx, 'warning', id, line, `Answer "${a}" doesn't use exactly the words in \`chunks:\`.`)
      })
      return {
        ...base,
        type: 'order',
        prompt: base.prompt || 'Put the words in the correct order.',
        chunks,
        answers
      } satisfies OrderQuestion
    }
    case 'match': {
      const pairs: { left: string; right: string }[] = []
      const rawPairs = r.pairs
      const pushString = (s: string): boolean => {
        const m = s.match(/^(.+?)\s+(?:=|->|→|::)\s+(.+)$/)
        if (!m) return false
        pairs.push({ left: m[1].trim(), right: m[2].trim() })
        return true
      }
      if (Array.isArray(rawPairs)) {
        for (const p of rawPairs) {
          if (typeof p === 'string') {
            if (!pushString(p)) return err(`Can't read pair "${p}". Use \`- left: right\` or \`- left = right\`.`)
          } else if (p && typeof p === 'object') {
            const o = p as Raw
            if ('left' in o && 'right' in o) pairs.push({ left: str(o.left) ?? '', right: str(o.right) ?? '' })
            else for (const [k, v] of Object.entries(o)) pairs.push({ left: k.trim(), right: str(v) ?? '' })
          }
        }
      } else if (rawPairs && typeof rawPairs === 'object') {
        for (const [k, v] of Object.entries(rawPairs as Raw)) pairs.push({ left: k.trim(), right: str(v) ?? '' })
      }
      if (pairs.length < 2) return err('`pairs:` needs at least 2 pairs, written as a list of `- left: right`.')
      if (pairs.some((p) => !p.left || !p.right)) return err('Every pair needs both a left and a right side.')
      if (new Set(pairs.map((p) => p.left)).size !== pairs.length) return err('Left sides in `pairs:` must be unique.')
      return { ...base, type: 'match', prompt: base.prompt || 'Match the pairs.', pairs } satisfies MatchQuestion
    }
    case 'tf': {
      if (!base.prompt) return err('Missing `q:` (the statement to judge).')
      const answer = normalizeTf(r.answer)
      if (!answer) return err('`answer:` must be `true`, `false` or `not given`.')
      const flag = r.notgiven === true || str(r.notgiven)?.toLowerCase() === 'true'
      return { ...base, type: 'tf', answer, notGiven: flag || answer === 'not given' } satisfies TfQuestion
    }
  }
}

// ───────────────────────── sections ─────────────────────────

interface Section {
  id: string
  /** 1-based line of the `## heading`. */
  line: number
  body: string
}

function splitSections(body: string, firstLine: number): { intro: string; sections: Section[] } {
  const lines = body.split('\n')
  const sections: Section[] = []
  const intro: string[] = []
  let current: { id: string; line: number; lines: string[] } | null = null
  let inFence = false
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) inFence = !inFence
    const h = !inFence && l.match(/^##\s+(.+?)\s*#*\s*$/)
    if (h) {
      if (current) sections.push({ id: current.id, line: current.line, body: current.lines.join('\n') })
      current = { id: h[1].trim(), line: firstLine + i, lines: [] }
    } else if (current) current.lines.push(l)
    else intro.push(l)
  })
  if (current) {
    const c = current as { id: string; line: number; lines: string[] }
    sections.push({ id: c.id, line: c.line, body: c.lines.join('\n') })
  }
  return { intro: intro.join('\n').trim(), sections }
}

function yamlErrorLine(e: unknown): { line?: number; reason: string } {
  const ex = e as { mark?: { line?: number }; reason?: string; message?: string }
  return { line: ex.mark?.line, reason: ex.reason ?? ex.message ?? String(e) }
}

// ───────────────────────── entry point ─────────────────────────

export function parseTest(source: string, id: string, mtime = 0): ParsedTest {
  const text = source.replace(/\r\n?/g, '\n').replace(/^﻿/, '')
  const issues: ParseIssue[] = []
  let data: Raw = {}
  let body = text
  let bodyFirstLine = 1

  try {
    const fm = matter(text)
    data = (fm.data ?? {}) as Raw
    body = fm.content
    if (text.endsWith(body)) bodyFirstLine = text.slice(0, text.length - body.length).split('\n').length
  } catch (e) {
    const { line, reason } = yamlErrorLine(e)
    issues.push({ severity: 'error', line: line !== undefined ? line + 1 : 1, message: `Frontmatter is not valid YAML: ${reason}` })
    body = text.replace(/^---\n[\s\S]*?\n---\n?/, '')
  }

  const { intro, sections } = splitSections(body, bodyFirstLine)
  const h1 = intro.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const fileTitle = id.replace(/\.md$/i, '').split('/').pop() ?? id
  const title = str(data.title) || h1 || fileTitle
  const topics = strList(data.topics ?? data.topic)
  const description = (str(data.description) ?? intro.replace(/^#\s+.+$/m, '').trim()) || ''
  const ctx: Ctx = { issues, testTopics: topics }
  const inherited = topics.length ? topics : ['General']

  const blocks: (SimpleQuestion | ReadingBlock)[] = []
  const seen = new Set<string>()

  for (const s of sections) {
    if (seen.has(s.id)) {
      issue(ctx, 'error', s.id, s.line, `Duplicate question id "## ${s.id}". Every heading must be unique.`)
      continue
    }
    seen.add(s.id)
    if (!s.body.trim()) {
      issue(ctx, 'error', s.id, s.line, 'Empty question block.')
      continue
    }
    let raw: unknown
    try {
      raw = load(quoteFreeTextValues(s.body))
    } catch (e) {
      const { line, reason } = yamlErrorLine(e)
      issue(ctx, 'error', s.id, line !== undefined ? s.line + 1 + line : s.line, `Can't read this block: ${reason}.`)
      continue
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      issue(ctx, 'error', s.id, s.line, 'Expected `key: value` lines (type, q, answer…).')
      continue
    }
    const r = normalizeKeys(raw as Raw)

    if (str(r.type)?.toLowerCase() === 'reading') {
      for (const k of Object.keys(r)) {
        if (!ALLOWED_KEYS.reading.includes(k)) issue(ctx, 'warning', s.id, s.line, `Unknown key \`${k}:\` is ignored (typo?).`)
      }
      const passage = typeof r.passage === 'string' ? r.passage.replace(/\s+$/, '') : ''
      if (!passage.trim()) {
        issue(ctx, 'error', s.id, s.line, 'Reading block needs a `passage: |` with the text.')
        continue
      }
      if (!Array.isArray(r.questions) || !r.questions.length) {
        issue(ctx, 'error', s.id, s.line, 'Reading block needs a `questions:` list with at least one sub-question.')
        continue
      }
      const readingTopics = strList(r.topic)
      const bodyLines = s.body.split('\n')
      const itemLines = bodyLines.flatMap((l, i) => (/^\s*-\s+type\s*:/i.test(l) ? [s.line + 1 + i] : []))
      const qs: SimpleQuestion[] = []
      r.questions.forEach((sub, i) => {
        const subId = `${s.id}.${i + 1}`
        const subLine = itemLines[i] ?? s.line
        if (!sub || typeof sub !== 'object' || Array.isArray(sub)) {
          issue(ctx, 'error', subId, subLine, 'Sub-question must be a `- type: …` item with keys.')
          return
        }
        const q = buildSimple(sub as Raw, subId, subLine, ctx, readingTopics.length ? readingTopics : inherited)
        if (q) qs.push(q)
      })
      if (qs.length) {
        blocks.push({
          type: 'reading',
          id: s.id,
          title: str(r.title) || s.id,
          passage,
          questions: qs,
          line: s.line
        })
      }
      continue
    }

    const q = buildSimple(r, s.id, s.line, ctx, inherited)
    if (q) blocks.push(q)
  }

  if (!sections.length) {
    issues.push({
      severity: 'error',
      line: bodyFirstLine,
      message: 'No questions found. Each question starts with a heading like `## Q1` followed by `type:`, `q:` and `answer:` lines.'
    })
  }

  const items: TestItem[] = blocks.flatMap((b) =>
    b.type === 'reading'
      ? b.questions.map((q) => ({
          ...q,
          key: `${id}#${q.id}`,
          testId: id,
          testTitle: title,
          reading: { id: b.id, title: b.title, passage: b.passage }
        }))
      : [{ ...b, key: `${id}#${b.id}`, testId: id, testTitle: title }]
  )

  return {
    id,
    title,
    topics,
    description,
    level: str(data.level),
    blocks,
    items,
    issues: issues.sort((a, b) => (a.line ?? 0) - (b.line ?? 0)),
    mtime
  }
}
