import Anthropic from '@anthropic-ai/sdk'
import { net } from 'electron'
import { dedupKey } from '@shared/dedup'
import type { Enrichment, ReadingGapText, ReadingTextResult, TranslateErrorCode, TranslateResult, TranslationProvider } from '@shared/types'
import { getSettings } from './data'
import { getSecret } from './secrets'
import { JsonFile } from './storage'

const PROVIDER_NAMES: Record<TranslationProvider, string> = { deepl: 'DeepL', claude: 'Claude', gemini: 'Gemini' }
const MAX_CHARS = 1500
const CACHE_LIMIT = 3000

interface CacheEntry {
  translation: string
  explanation?: string
  at: number
}
const cache = new JsonFile<Record<string, CacheEntry>>('translation-cache.json', () => ({}))

/** Network failure → a message that says whether it was a timeout (VPN / proxy / firewall) or no connection. */
function networkError(service: string, e: unknown): TranslateError {
  const name = (e as { name?: string })?.name
  if (name === 'TimeoutError' || name === 'AbortError')
    return new TranslateError('offline', `${service} didn't answer in time. If you use a VPN or proxy, check that it allows ${service}, then try again.`, true)
  return new TranslateError('offline', `Couldn't reach ${service}. Check your internet connection or VPN.`)
}

class TranslateError extends Error {
  constructor(
    public code: TranslateErrorCode,
    message: string,
    /** True when trying another model may help (overload, per-model rate limit, timeout). */
    public retryable = false
  ) {
    super(message)
  }
}

const fail = (code: TranslateErrorCode, message: string): TranslateResult => ({ ok: false, code, message })

// ───────────── DeepL ─────────────

async function deepl(text: string, context: string | undefined, key: string): Promise<{ translation: string }> {
  // Free-plan keys end with ":fx" and must use the Free endpoint.
  const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
  let res: Response
  try {
    res = await net.fetch(`${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: [text],
        source_lang: 'EN',
        target_lang: 'UK',
        ...(context && context !== text ? { context } : {})
      }),
      signal: AbortSignal.timeout(15_000)
    })
  } catch (e) {
    throw networkError('DeepL', e)
  }
  if (res.status === 403 || res.status === 401) throw new TranslateError('auth', 'DeepL rejected the API key. Check it in Settings.')
  if (res.status === 456) throw new TranslateError('quota', 'DeepL monthly quota exceeded. It resets at the start of your billing period.')
  if (res.status === 429) throw new TranslateError('rate-limit', 'Too many requests to DeepL. Wait a few seconds and try again.')
  if (!res.ok) throw new TranslateError('unknown', `DeepL error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = (await res.json()) as { translations?: { text: string }[] }
  const translation = json.translations?.[0]?.text
  if (!translation) throw new TranslateError('unknown', 'DeepL returned an empty response.')
  return { translation }
}

// ───────────── LLM calls with JSON output (Claude / Gemini) ─────────────

interface JsonSchema {
  type: 'object' | 'string' | 'array' | 'integer'
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  required?: string[]
  additionalProperties?: boolean
  enum?: string[]
}

interface LlmRequest {
  system: string
  user: string
  schema: JsonSchema
  /** For messages, e.g. "translate this fragment". */
  task: string
}

type Json = Record<string, unknown>

/** Models that accept the server-side refusal fallback (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-1'])

async function claudeJson(req: LlmRequest, key: string, model: string): Promise<Json> {
  const client = new Anthropic({ apiKey: key, timeout: 60_000, maxRetries: 1, fetch: ((url: string, init?: RequestInit) => net.fetch(url, init)) as unknown as typeof fetch })
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 2000,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: req.schema as unknown as Json } },
      ...(FALLBACK_MODELS.has(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {})
    })
    if (response.stop_reason === 'refusal') throw new TranslateError('unknown', `Claude declined to ${req.task}.`)
    if (response.stop_reason === 'max_tokens') throw new TranslateError('unknown', 'The answer was cut off. Try a shorter fragment.')
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') throw new TranslateError('unknown', 'Claude returned an empty response.')
    return JSON.parse(block.text) as Json
  } catch (e) {
    if (e instanceof TranslateError) throw e
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      throw new TranslateError('auth', 'Claude rejected the API key. Check it in Settings.')
    if (e instanceof Anthropic.RateLimitError) throw new TranslateError('rate-limit', 'Claude rate limit reached. Wait a moment and try again.')
    if (e instanceof Anthropic.NotFoundError) throw new TranslateError('unknown', `Model "${model}" was not found. Pick another model in Settings.`)
    if (e instanceof Anthropic.APIConnectionError) throw new TranslateError('offline', "Couldn't reach the Claude API. Check your internet connection.")
    if (e instanceof Anthropic.BadRequestError) {
      if (/credit|billing|balance/i.test(e.message)) throw new TranslateError('quota', 'Your Anthropic credit balance is too low. Top up in the Claude Console.')
      throw new TranslateError('unknown', `Claude API error: ${e.message.slice(0, 200)}`)
    }
    if (e instanceof Anthropic.APIError) throw new TranslateError('unknown', `Claude API error ${e.status ?? ''}: ${e.message.slice(0, 200)}`)
    if (e instanceof SyntaxError) throw new TranslateError('unknown', 'Could not read the response from Claude.')
    throw new TranslateError('unknown', String(e))
  }
}

/** Gemini's `responseSchema` uses upper-case OpenAPI types and has no `additionalProperties`. */
function toGeminiSchema(s: JsonSchema): Json {
  return {
    type: s.type.toUpperCase(),
    ...(s.properties ? { properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)])) } : {}),
    ...(s.items ? { items: toGeminiSchema(s.items) } : {}),
    ...(s.required ? { required: s.required } : {}),
    ...(s.enum ? { enum: s.enum } : {})
  }
}

interface GeminiResponse {
  usageMetadata?: { thoughtsTokenCount?: number; candidatesTokenCount?: number }
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  error?: { code?: number; message?: string; status?: string }
}

async function geminiJsonOnce(req: LlmRequest, key: string, model: string, cancel: AbortSignal): Promise<Json> {
  let res: Response
  const started = Date.now()
  try {
    res = await net.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: toGeminiSchema(req.schema), maxOutputTokens: 4000 }
      }),
      signal: AbortSignal.any([cancel, AbortSignal.timeout(10_000)])
    })
  } catch (e) {
    if (process.env.EW_DEBUG) console.log(`[gemini] ${model} → network error after ${Date.now() - started} ms: ${String(e)}`)
    throw networkError('Gemini', e)
  }
  const body = (await res.json().catch(() => null)) as GeminiResponse | null
  if (process.env.EW_DEBUG) console.log(`[gemini] ${model} → HTTP ${res.status} in ${Date.now() - started} ms ${body?.error?.message?.slice(0, 80) ?? ''}`)
  if (!res.ok) {
    const msg = body?.error?.message ?? ''
    if (res.status === 401 || res.status === 403 || /API key not valid|API_KEY_INVALID|API key expired/i.test(msg))
      throw new TranslateError('auth', /location/i.test(msg) ? 'Gemini API is not available in your region.' : 'Gemini rejected the API key. Check it in Settings.')
    if (res.status === 429)
      throw new TranslateError('rate-limit', 'Gemini free limit reached (per minute or per day). Wait a minute and try again; if it keeps failing, the daily quota is used up.', true)
    if (res.status === 500 || res.status === 503 || res.status === 504)
      throw new TranslateError('unknown', `Gemini is overloaded right now (HTTP ${res.status}: ${msg.slice(0, 100)}). Try again in a minute, or switch the provider in Settings.`, true)
    if (res.status === 404) throw new TranslateError('unknown', `Model "${model}" was not found (HTTP 404: ${msg.slice(0, 120)}). Pick another model in Settings.`, true)
    throw new TranslateError('unknown', `Gemini error ${res.status}: ${msg.slice(0, 200)}`)
  }
  if (body?.promptFeedback?.blockReason) throw new TranslateError('unknown', `Gemini declined to ${req.task}.`)
  const cand = body?.candidates?.[0]
  const raw = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!raw) throw new TranslateError('unknown', cand?.finishReason === 'MAX_TOKENS' ? 'The answer was cut off. Try a shorter fragment.' : 'Gemini returned an empty response.', true)
  try {
    return JSON.parse(raw) as Json
  } catch {
    throw new TranslateError('unknown', 'Could not read the response from Gemini.', true)
  }
}

/**
 * The Gemini free tier is erratic: the same request takes 1 s or 10 s, or returns 503 ("high demand").
 * So requests are hedged: if the first model hasn't answered within HEDGE_MS (or fails with a retryable
 * error) the next model is started in parallel. The first success wins and the rest are cancelled.
 * Free-tier limits and overload are per model, and a short request costs next to nothing.
 */
const GEMINI_FALLBACKS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash']
const HEDGE_MS = 1_800

function geminiJson(req: LlmRequest, key: string, model: string): Promise<Json> {
  const chain = [model, ...GEMINI_FALLBACKS.filter((m) => m !== model)].slice(0, 3)
  return new Promise((resolve, reject) => {
    const controllers: AbortController[] = []
    let next = 0
    let running = 0
    let settled = false
    let lastError: TranslateError | null = null
    let timer: NodeJS.Timeout | null = null

    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      controllers.forEach((c) => c.abort())
      fn()
    }

    const launch = (): void => {
      if (settled || next >= chain.length) return
      const ctrl = new AbortController()
      controllers.push(ctrl)
      const m = chain[next++]
      running++
      geminiJsonOnce(req, key, m, ctrl.signal).then(
        (r) => finish(() => resolve(r)),
        (e: unknown) => {
          running--
          if (settled) return
          if (e instanceof TranslateError && e.retryable) {
            lastError = e
            launch() // fail fast: start the next model right away
            if (running === 0 && next >= chain.length) finish(() => reject(lastError))
          } else finish(() => reject(e))
        }
      )
      if (next < chain.length) {
        if (timer) clearTimeout(timer)
        timer = setTimeout(launch, HEDGE_MS)
      }
    }
    launch()
  })
}

// ───────────── translation with a grammar note ─────────────

const TUTOR_SYSTEM = `You are a friendly English tutor for a native Ukrainian speaker.
The learner selected a fragment of English text while studying. Translate the fragment into natural Ukrainian
and explain the grammar of the fragment as it is used in its context.

- "translation": a natural Ukrainian translation of the selected fragment only.
- "explanation": in Ukrainian, 1–4 short sentences. Name the grammar (tense, voice, construction, phrasal verb, idiom)
  and why it is used here; quote English forms in **bold**. If the fragment is a single word, give its part of speech,
  the most relevant meanings and its forms (e.g. irregular verb forms). Markdown is allowed, no headings.`

const TRANSLATION_SCHEMA: JsonSchema = {
  type: 'object',
  properties: { translation: { type: 'string' }, explanation: { type: 'string' } },
  required: ['translation', 'explanation'],
  additionalProperties: false
}

function tutorRequest(text: string, context?: string): LlmRequest {
  const user = context && context !== text ? `Selected fragment:\n"""${text}"""\n\nContext:\n"""${context}"""` : `Selected fragment:\n"""${text}"""`
  return { system: TUTOR_SYSTEM, user, schema: TRANSLATION_SCHEMA, task: 'translate this fragment' }
}

function asTranslation(r: Json, who: string): { translation: string; explanation: string } {
  if (typeof r.translation !== 'string' || !r.translation.trim()) throw new TranslateError('unknown', `${who} returned an unexpected response.`)
  return { translation: r.translation.trim(), explanation: typeof r.explanation === 'string' ? r.explanation : '' }
}

async function claude(text: string, context: string | undefined, key: string, model: string): Promise<{ translation: string; explanation: string }> {
  return asTranslation(await claudeJson(tutorRequest(text, context), key, model), 'Claude')
}

async function gemini(text: string, context: string | undefined, key: string, model: string): Promise<{ translation: string; explanation: string }> {
  return asTranslation(await geminiJson(tutorRequest(text, context), key, model), 'Gemini')
}

// ───────────── entry point ─────────────

function cacheKey(provider: TranslationProvider, model: string, text: string, context?: string): string {
  // DeepL output barely depends on context; Claude's explanation does.
  return provider === 'deepl' ? `deepl|${text}` : `${provider}|${model}|${text}|${context ?? ''}`
}

const PROVIDER_ORDER: TranslationProvider[] = ['gemini', 'deepl', 'claude']
const FALLBACK_CODES = new Set<TranslateErrorCode>(['offline', 'rate-limit', 'quota', 'unknown'])

function modelFor(provider: TranslationProvider, settings: ReturnType<typeof getSettings>): string {
  return provider === 'gemini' ? settings.geminiModel : provider === 'claude' ? settings.claudeModel : ''
}

function callProvider(provider: TranslationProvider, text: string, ctx: string | undefined, key: string, model: string): Promise<{ translation: string; explanation?: string }> {
  return provider === 'deepl' ? deepl(text, ctx, key) : provider === 'gemini' ? gemini(text, ctx, key, model) : claude(text, ctx, key, model)
}

function remember(k: string, result: { translation: string; explanation?: string }): void {
  cache.update((c) => {
    const next = { ...c, [k]: { ...result, at: Date.now() } }
    const keys = Object.keys(next)
    if (keys.length > CACHE_LIMIT) {
      keys
        .sort((a, b) => next[a].at - next[b].at)
        .slice(0, keys.length - CACHE_LIMIT)
        .forEach((old) => delete next[old])
    }
    return next
  })
}

export async function translate(rawText: string, context?: string, opts: { skipCache?: boolean; provider?: TranslationProvider } = {}): Promise<TranslateResult> {
  const text = rawText.replace(/\s+/g, ' ').trim()
  if (!text) return fail('unknown', 'Nothing to translate.')
  if (text.length > MAX_CHARS) return fail('too-long', `Select up to ${MAX_CHARS} characters at a time.`)
  const settings = getSettings()
  const provider = opts.provider ?? settings.provider
  const model = modelFor(provider, settings)
  const ctx = context?.replace(/\s+/g, ' ').trim().slice(0, 600)
  const k = cacheKey(provider, model, text, ctx)

  if (!opts.skipCache) {
    const hit = cache.get()[k]
    if (hit) return { ok: true, translation: hit.translation, explanation: hit.explanation, provider, cached: true }
  }

  // Dev-only fake provider for automated UI tests (never set in normal use).
  if (process.env.EW_FAKE_TRANSLATE) {
    await new Promise((r) => setTimeout(r, 250))
    return { ok: true, translation: `[uk] ${text}`, explanation: provider !== 'deepl' ? '**Fake** grammar note.' : undefined, provider, cached: false }
  }

  const key = getSecret(provider)
  if (!key)
    return fail('no-key', `Add your ${PROVIDER_NAMES[provider]} API key in Settings to translate.`)
  if (!net.isOnline()) return fail('offline', "You're offline. Translations you've already looked up still work.")

  try {
    const result = await callProvider(provider, text, ctx, key, model)
    remember(k, result)
    return { ok: true, ...result, provider, cached: false }
  } catch (e) {
    const err = e instanceof TranslateError ? e : new TranslateError('unknown', String(e))
    // The chosen provider is down, slow or out of quota → try another one that has a saved key
    // (not for explicit key tests, and never for bad keys, which the user must fix).
    if (!opts.provider && FALLBACK_CODES.has(err.code)) {
      for (const alt of PROVIDER_ORDER.filter((p) => p !== provider)) {
        const altKey = getSecret(alt)
        if (!altKey) continue
        const altModel = modelFor(alt, settings)
        try {
          const r = await callProvider(alt, text, ctx, altKey, altModel)
          remember(cacheKey(alt, altModel, text, ctx), r)
          return { ok: true, ...r, provider: alt, cached: false }
        } catch {
          /* try the next one */
        }
      }
    }
    return fail(err.code, err.message)
  }
}

export function clearTranslationCache(): number {
  const n = Object.keys(cache.get()).length
  cache.set({})
  return n
}

export function translationCacheSize(): number {
  return Object.keys(cache.get()).length
}

// ───────────── AI enrichment of vocabulary cards ─────────────

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const ENRICH_SYSTEM = `You help a native Ukrainian speaker build an English vocabulary deck.
For the given English word or phrase (in the meaning used in the context, if one is given) return:
- "pos": part of speech in lower-case English: noun, verb, adjective, adverb, phrasal verb, idiom, phrase,
  preposition, conjunction, pronoun, determiner or interjection.
- "ipa": General American IPA between slashes, e.g. /brɪdʒ/. For long phrases transcribe the key word(s) only.
- "level": the CEFR level of this meaning: A1, A2, B1, B2, C1 or C2.
- "topic": ONE short English topic (1–2 words, Title Case) used to group the learner's words, e.g. Work, Travel,
  Emotions, Phrasal Verbs, Grammar, Food, Health, Education, Technology, Money, Everyday Life.
  If one of the learner's existing topics fits, return it exactly as written.
- "examples": 2–3 short, natural example sentences (B1–B2) using it in the same meaning.
- "translation": the best concise Ukrainian translation(s) of this meaning; 2–3 comma-separated variants if common.`

const ENRICH_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    pos: { type: 'string' },
    ipa: { type: 'string' },
    level: { type: 'string', enum: LEVELS },
    topic: { type: 'string' },
    examples: { type: 'array', items: { type: 'string' } },
    translation: { type: 'string' }
  },
  required: ['pos', 'ipa', 'level', 'topic', 'examples', 'translation'],
  additionalProperties: false
}

export type EnrichResult = { ok: true; data: Enrichment; provider: TranslationProvider } | { ok: false; code: TranslateErrorCode; message: string }

function asEnrichment(r: Json): Enrichment {
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  const level = str(r.level).toUpperCase()
  return {
    pos: str(r.pos).toLowerCase(),
    ipa: str(r.ipa),
    level: LEVELS.includes(level) ? level : '',
    topic: str(r.topic).slice(0, 30),
    examples: Array.isArray(r.examples) ? r.examples.map(str).filter(Boolean).slice(0, 3) : [],
    translation: str(r.translation)
  }
}

/** Uses Gemini or Claude (whichever is selected / has a key) to fill part of speech, IPA, level, topic and examples. */
export async function enrichWord(word: { text: string; translation: string; context?: string }, existingTopics: string[]): Promise<EnrichResult> {
  if (process.env.EW_FAKE_TRANSLATE) {
    await new Promise((r) => setTimeout(r, 200))
    return { ok: true, provider: 'gemini', data: { pos: 'verb', ipa: '/fake/', level: 'B1', topic: existingTopics[0] ?? 'Everyday Life', examples: [`I use "${word.text}" every day.`], translation: word.translation } }
  }
  const topics = existingTopics.length ? `\nThe learner's existing topics: ${existingTopics.slice(0, 40).join(', ')}.` : ''
  const r = await runLlm(
    {
      system: ENRICH_SYSTEM,
      user: `Word or phrase: """${word.text}"""\nKnown translation: ${word.translation || '(none)'}${word.context ? `\nContext: """${word.context}"""` : ''}${topics}`,
      schema: ENRICH_SCHEMA,
      task: 'describe this word'
    },
    'AI enrichment'
  )
  if (!r.ok) return r
  return { ok: true, provider: r.provider, data: asEnrichment(r.data) }
}

type LlmResult = { ok: true; data: Json; provider: TranslationProvider } | { ok: false; code: TranslateErrorCode; message: string }

/** Runs a JSON-returning request on the chosen provider (Gemini or Claude), falling back to the other one. */
async function runLlm(req: LlmRequest, what: string): Promise<LlmResult> {
  const settings = getSettings()
  const order: TranslationProvider[] = settings.provider === 'claude' ? ['claude', 'gemini'] : ['gemini', 'claude']
  const usable = order.filter((p) => getSecret(p))
  if (!usable.length) return { ok: false, code: 'no-key', message: `${what} needs a Gemini or Claude API key (Settings → Translation).` }
  if (!net.isOnline()) return { ok: false, code: 'offline', message: "You're offline." }
  let last: TranslateError | null = null
  for (const p of usable) {
    const key = getSecret(p) as string
    try {
      const data = p === 'gemini' ? await geminiJson(req, key, settings.geminiModel) : await claudeJson(req, key, settings.claudeModel)
      return { ok: true, data, provider: p }
    } catch (e) {
      last = e instanceof TranslateError ? e : new TranslateError('unknown', String(e))
      if (!FALLBACK_CODES.has(last.code)) break
    }
  }
  return { ok: false, code: last?.code ?? 'unknown', message: last?.message ?? `${what} failed.` }
}

// ───────────── reading passage for "fill the gaps" ─────────────

const READING_SYSTEM = `You write short reading passages for Ukrainian learners of English (level B1–B2).
Write ONE coherent, natural passage (110–170 words, one or two short paragraphs, plain text) about an everyday topic that
uses ALL of the given words or phrases, each exactly once. Do not use any of the listed words anywhere else in the text.

Replace each use with a numbered placeholder {1}, {2}, {3}… in the order they appear in the text.
For every placeholder return:
- "n": the placeholder number;
- "word": the item from the list, exactly as given;
- "form": the exact words that fit the gap. You may inflect the item to fit the grammar (gave up, deadlines, looking forward to),
  but keep it recognisable.

Write the sentences around each gap so that exactly one of the listed words fits it (the surrounding meaning and grammar must make
the choice clear), and so that a learner who knows the word can find it. Give the passage a short title. No translations, no Markdown.`

const READING_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    passage: { type: 'string' },
    gaps: {
      type: 'array',
      items: { type: 'object', properties: { n: { type: 'integer' }, word: { type: 'string' }, form: { type: 'string' } }, required: ['n', 'word', 'form'], additionalProperties: false }
    }
  },
  required: ['title', 'passage', 'gaps'],
  additionalProperties: false
}

/** Checks that the model followed the format: every placeholder once, every gap tied to one of our words. */
function validateReading(raw: Json, words: { id: string; text: string }[]): ReadingGapText | null {
  const passage = typeof raw.passage === 'string' ? raw.passage.trim() : ''
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Fill the gaps'
  const gapsRaw = Array.isArray(raw.gaps) ? raw.gaps : []
  const placeholders = [...passage.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]))
  if (!passage || !placeholders.length || new Set(placeholders).size !== placeholders.length) return null
  const gaps: ReadingGapText['gaps'] = []
  const usedWords = new Set<string>()
  for (const g of gapsRaw as Json[]) {
    const n = Number(g.n)
    const form = typeof g.form === 'string' ? g.form.trim() : ''
    const entry = words.find((w) => dedupKey(w.text) === dedupKey(String(g.word ?? '')))
    if (!placeholders.includes(n) || !form || form.length > 40 || !entry || usedWords.has(entry.id) || gaps.some((x) => x.n === n)) return null
    usedWords.add(entry.id)
    gaps.push({ n, entryId: entry.id, form })
  }
  if (gaps.length !== placeholders.length || gaps.length < Math.min(3, words.length)) return null
  return { title, passage, gaps: gaps.sort((a, b) => a.n - b.n) }
}

/** Asks the AI for a short passage that uses the learner's words once each, with a gap for every word. */
export async function generateReadingPassage(words: { id: string; text: string; translation: string; pos?: string }[]): Promise<ReadingTextResult> {
  const list = words.slice(0, 8)
  if (process.env.EW_FAKE_TRANSLATE) {
    await new Promise((r) => setTimeout(r, 300))
    const gaps = list.map((w, i) => ({ n: i + 1, entryId: w.id, form: w.text }))
    return { ok: true, provider: 'gemini', title: 'A short fake story', passage: list.map((_w, i) => `On day ${i + 1} we needed {${i + 1}} to finish the plan.`).join(' '), gaps }
  }
  const req: LlmRequest = {
    system: READING_SYSTEM,
    user: `Words and phrases to use:\n${list.map((w, i) => `${i + 1}. ${w.text}${w.pos ? ` (${w.pos})` : ''} — ${w.translation}`).join('\n')}`,
    schema: READING_SCHEMA,
    task: 'write the passage'
  }
  let last: { code: TranslateErrorCode; message: string } = { code: 'unknown', message: 'The AI did not return a usable text.' }
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await runLlm(req, 'The reading text')
    if (!r.ok) {
      last = r
      if (!FALLBACK_CODES.has(r.code)) break
      continue
    }
    const ok = validateReading(r.data, list)
    if (ok) return { ok: true, provider: r.provider, ...ok }
    last = { code: 'unknown', message: 'The AI returned a text in the wrong format.' }
  }
  return { ok: false, ...last }
}
