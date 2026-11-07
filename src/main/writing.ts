import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MISTAKE_CATEGORIES, type NewWritingEntry, type WritingEntry, type WritingEvaluation, type WritingResult } from '@shared/types'
import { CRITERIA, CRITERION_LABEL, chatTranscript, countWords, entryToMarkdown, learnerText, normalizeEvaluation, slugify } from '@shared/writing'
import { monthKey } from '@shared/writingTasks'
import { getSettings } from './data'
import { JsonFile } from './storage'
import { type JsonSchema, type LlmRequest, runLlm } from './translate'

const file = new JsonFile<WritingEntry[]>('writing.json', () => [], 'workbook')

const now = (): string => new Date().toISOString()
const MAX_TEXT = 20_000
const MIN_ESSAY_WORDS = 30
const MIN_CHAT_MESSAGES = 2
const MAX_CHAT_MESSAGES = 16

const fail = (code: Extract<WritingResult, { ok: false }>['code'], message: string): WritingResult => ({ ok: false, code, message })

export function listWriting(): WritingEntry[] {
  return [...file.get()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function find(id: string): WritingEntry | undefined {
  return file.get().find((e) => e.id === id)
}

function put(entry: WritingEntry): WritingEntry {
  const next = { ...entry, updatedAt: now() }
  file.update((list) => (list.some((e) => e.id === entry.id) ? list.map((e) => (e.id === entry.id ? next : e)) : [...list, next]))
  return next
}

export function createWriting(input: NewWritingEntry): WritingEntry {
  const at = now()
  const entry: WritingEntry = {
    id: randomUUID(),
    kind: input.kind === 'chat' ? 'chat' : 'essay',
    title: String(input.title ?? '').trim().slice(0, 120) || 'Untitled',
    prompt: String(input.prompt ?? '').trim().slice(0, 4000),
    taskId: input.taskId,
    month: monthKey(),
    createdAt: at,
    updatedAt: at,
    status: 'draft',
    targetWords: (input.targetWords ?? []).map(String).slice(0, 8),
    text: '',
    minWords: input.minWords,
    maxWords: input.maxWords,
    scenarioId: input.scenarioId,
    aiRole: input.aiRole,
    register: input.register,
    goals: input.goals,
    messages: input.opening ? [{ role: 'assistant', content: input.opening, at }] : []
  }
  return put(entry)
}

/** Autosave of an essay draft. Evaluated essays are never changed. */
export function saveWritingText(id: string, text: string): void {
  const e = find(id)
  if (!e || e.kind !== 'essay' || e.status !== 'draft') return
  put({ ...e, text: String(text).slice(0, MAX_TEXT) })
}

export function removeWriting(id: string): void {
  file.update((list) => list.filter((e) => e.id !== id))
}

// ───────────── prompts ─────────────

const lang = (): string => (getSettings().feedbackLanguage === 'en' ? 'English' : 'Ukrainian')

const EVAL_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    content: { type: 'integer' },
    style: { type: 'integer' },
    vocabulary: { type: 'integer' },
    grammar: { type: 'integer' },
    cefr: { type: 'string', enum: ['A2', 'B1', 'B2', 'C1'] },
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    improvements: { type: 'array', items: { type: 'string' } },
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: { original: { type: 'string' }, corrected: { type: 'string' }, explanation: { type: 'string' }, category: { type: 'string', enum: [...MISTAKE_CATEGORIES] } },
        required: ['original', 'corrected', 'explanation', 'category'],
        additionalProperties: false
      }
    },
    improved: { type: 'string' },
    targetWords: {
      type: 'array',
      items: {
        type: 'object',
        properties: { word: { type: 'string' }, used: { type: 'boolean' }, correct: { type: 'boolean' }, note: { type: 'string' } },
        required: ['word', 'used', 'correct', 'note'],
        additionalProperties: false
      }
    }
  },
  required: ['content', 'style', 'vocabulary', 'grammar', 'cefr', 'summary', 'strengths', 'improvements', 'corrections', 'improved', 'targetWords'],
  additionalProperties: false
}

function evalRequest(e: WritingEntry): LlmRequest {
  const labels = CRITERION_LABEL[e.kind]
  const essay = e.kind === 'essay'
  const system = `You are an experienced English examiner and teacher. A Ukrainian learner of English (target level B1–B2) wrote the ${essay ? 'text below' : 'LEARNER lines of the conversation below'}. Evaluate it fairly, without inflating the marks.

Score each criterion with an integer from 0 to 5:
${CRITERIA.map((k) => `- ${k} (${labels[k].name}): ${labels[k].hint}`).join('\n')}
Scale: 0 = nothing relevant or not understandable; 1 = very weak; 2 = below B1; 3 = B1, adequate with noticeable problems; 4 = solid B2, only a few problems; 5 = very good, close to a confident user for this task.
${essay ? 'If the text is much shorter than required or does not answer the task, give "content" a low score.' : 'Only the LEARNER lines are evaluated; ignore the other speaker.'}

Also return:
- cefr: the level the writing shows overall (A2, B1, B2 or C1).
- summary: 2–3 sentences with an honest overall impression.
- strengths: up to 4 specific things done well. improvements: up to 4 concrete priorities for next time.
- corrections: up to 12 of the most important mistakes. "original" must be copied EXACTLY, character for character, from the learner's own words (a short phrase or one sentence, never a whole paragraph); "corrected" is the fixed version; "explanation" gives the rule briefly; "category" is one of: ${MISTAKE_CATEGORIES.join(', ')}. Never invent mistakes; if there are none, return an empty list.
- improved: ${essay ? "the learner's whole text rewritten without the mistakes, keeping their ideas and roughly their level" : "the learner's messages rewritten without the mistakes, one per line, in the same order"}.
- targetWords: for every target word given, whether it was used correctly and a very short note.
Write the summary, strengths, improvements, explanations and notes in ${lang()}. Corrected phrases and the improved version stay in English.`
  const target = e.targetWords.length ? `\n\nTarget words the learner tried to use: ${e.targetWords.join('; ')}` : ''
  const user = essay
    ? `Task:\n${e.prompt}${target}\n\nRequired length: ${e.minWords ?? 120}–${e.maxWords ?? 200} words.\n\nLearner's text (${countWords(e.text)} words):\n"""\n${e.text}\n"""`
    : `Situation: ${e.prompt}\nThe learner should: ${(e.goals ?? []).join('; ')}\nRegister: ${e.register ?? 'neutral'}${target}\n\nConversation:\n${chatTranscript(e.messages, 40)}`
  return { system, user, schema: EVAL_SCHEMA, task: 'evaluate this writing' }
}

const CHAT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: { reply: { type: 'string' }, tip: { type: 'string' }, done: { type: 'boolean' } },
  required: ['reply', 'tip', 'done'],
  additionalProperties: false
}

function chatRequest(e: WritingEntry): LlmRequest {
  const tips = getSettings().chatTips
  const system = `You are role-playing in a short written conversation (an email exchange or a chat) with a Ukrainian learner of English at B1–B2 level, to give them realistic practice.
Your role: ${e.aiRole ?? 'a friendly partner'}.
Situation: ${e.prompt}
Register: ${e.register ?? 'neutral'}.
What the learner should achieve: ${(e.goals ?? []).join('; ') || 'have a natural conversation'}.

Rules:
- Stay in role. Reply in 1–4 sentences of natural, clear English (a little simpler than native speed).
- Keep the conversation going: react to what the learner wrote and ask a question or suggest the next step, unless the goals are reached.
- Never write the learner's lines and never correct the learner inside your reply.
${e.targetWords.length ? `- Create chances for the learner to use these words: ${e.targetWords.join('; ')}. Do not use all of them yourself.\n` : ''}- Set "done" to true when the goals have been reached or the conversation has come to a natural end (also after about 8 learner messages); then close the conversation politely in your reply.
- "tip": ${tips ? `if the learner's LAST message has a clear mistake, give ONE short tip in ${lang()} with the fix, for example «"I am agree" → "I agree" (agree is a verb)». Mention only the most important mistake. If there is no clear mistake, return an empty string.` : 'always an empty string.'}`
  return { system, user: `Conversation so far:\n${chatTranscript(e.messages)}\n\nWrite your next reply.`, schema: CHAT_SCHEMA, task: 'continue the conversation' }
}

// ───────────── fake provider for automated UI tests (never set in normal use) ─────────────

function fakeEvaluation(e: WritingEntry): Record<string, unknown> {
  const text = learnerText(e)
  const first = text.trim().split(/\s+/).slice(0, 3).join(' ')
  return {
    content: 4,
    style: 3,
    vocabulary: 4,
    grammar: 3,
    cefr: 'B1',
    summary: 'A fake evaluation for testing: clear ideas, a few grammar slips.',
    strengths: ['Clear ideas', 'Good range of words'],
    improvements: ['Check past tenses', 'Use more linking words'],
    corrections: first ? [{ original: first, corrected: `${first} (fixed)`, explanation: 'A fake explanation.', category: 'grammar' }] : [],
    improved: text,
    targetWords: e.targetWords.map((word) => ({ word, used: true, correct: true, note: 'Used well.' }))
  }
}

// ───────────── evaluation and conversation ─────────────

function exportFile(e: WritingEntry): void {
  const dir = getSettings().contentDir
  if (!dir) return
  try {
    const folder = join(dir, 'writing')
    mkdirSync(folder, { recursive: true })
    const base = `${e.createdAt.slice(0, 10)}-${slugify(e.title)}`
    let path = join(folder, `${base}.md`)
    for (let i = 2; existsSync(path); i++) path = join(folder, `${base}-${i}.md`)
    writeFileSync(path, entryToMarkdown(e), 'utf8')
  } catch (err) {
    console.error('[writing] could not save the Markdown copy', err)
  }
}

/** Evaluates an essay, or a conversation once the learner has written enough. */
export async function evaluateWriting(id: string): Promise<WritingResult> {
  const e = find(id)
  if (!e) return fail('unknown', 'This entry no longer exists.')
  if (e.status === 'evaluated') return { ok: true, entry: e }
  const learner = learnerText(e)
  if (e.kind === 'essay' && countWords(learner) < MIN_ESSAY_WORDS) return fail('unknown', `Write at least ${MIN_ESSAY_WORDS} words to get feedback.`)
  if (e.kind === 'chat' && e.messages.filter((m) => m.role === 'user').length < MIN_CHAT_MESSAGES) return fail('unknown', 'Write at least two messages to get feedback.')

  let evaluation: WritingEvaluation | null = null
  if (process.env.EW_FAKE_TRANSLATE) {
    await new Promise((r) => setTimeout(r, 300))
    evaluation = normalizeEvaluation(fakeEvaluation(e), { learnerText: learner, targetWords: e.targetWords, provider: 'gemini', at: now() })
  } else {
    // One more try when the model's answer is in the wrong format (provider fallback is inside runLlm).
    for (let attempt = 0; attempt < 2 && !evaluation; attempt++) {
      const r = await runLlm(evalRequest(e), 'The evaluation')
      if (!r.ok) return fail(r.code, r.message)
      evaluation = normalizeEvaluation(r.data, { learnerText: learner, targetWords: e.targetWords, provider: r.provider, at: now() })
    }
  }
  if (!evaluation) return fail('unknown', 'The AI returned an evaluation in the wrong format. Try again.')
  const saved = put({ ...e, status: 'evaluated', evaluation })
  exportFile(saved)
  return { ok: true, entry: saved }
}

/** Adds the learner's message and the partner's reply (with a tip about a mistake, if any). Nothing is saved on failure. */
export async function chatTurn(id: string, text: string): Promise<WritingResult> {
  const e = find(id)
  if (!e || e.kind !== 'chat') return fail('unknown', 'This conversation no longer exists.')
  if (e.status !== 'draft') return fail('unknown', 'This conversation is finished.')
  const message = String(text).trim().slice(0, 2000)
  if (!message) return fail('unknown', 'Write a message first.')
  if (e.messages.length >= MAX_CHAT_MESSAGES * 2) return fail('unknown', 'This conversation is long enough — ask for feedback.')

  const at = now()
  const draft: WritingEntry = { ...e, messages: [...e.messages, { role: 'user', content: message, at }] }
  let reply = ''
  let tip = ''
  let done = false
  if (process.env.EW_FAKE_TRANSLATE) {
    await new Promise((r) => setTimeout(r, 250))
    const n = draft.messages.filter((m) => m.role === 'user').length
    reply = `Thanks for your message ${n}. (fake) Could you tell me more?`
    tip = /I am agree/i.test(message) ? '«"I am agree" → "I agree" (agree is a verb)»' : ''
    done = n >= 3
  } else {
    const r = await runLlm(chatRequest(draft), 'The conversation')
    if (!r.ok) return fail(r.code, r.message)
    reply = typeof r.data.reply === 'string' ? r.data.reply.trim() : ''
    tip = getSettings().chatTips && typeof r.data.tip === 'string' ? r.data.tip.trim() : ''
    done = r.data.done === true
    if (!reply) return fail('unknown', 'The AI returned an empty reply. Try again.')
  }
  const messages = [...draft.messages]
  messages[messages.length - 1] = { ...messages[messages.length - 1], ...(tip ? { tip } : {}) }
  messages.push({ role: 'assistant', content: reply, at: now() })
  return { ok: true, entry: put({ ...e, messages, chatDone: done || e.chatDone }) }
}
