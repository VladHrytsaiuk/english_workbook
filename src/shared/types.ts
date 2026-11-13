// Types shared between the main process, the preload bridge and the renderer.

// ───────────────────────── Content ─────────────────────────

export interface NoteDoc {
  /** Path relative to `<content>/notes`, e.g. `tenses.md` or `grammar/articles.md`. */
  id: string
  title: string
  /** Markdown body without frontmatter. */
  content: string
  tags: string[]
  mtime: number
}

export type QuestionType = 'choice' | 'gap' | 'transform' | 'error' | 'order' | 'match' | 'tf' | 'reading'
export type SimpleQuestionType = Exclude<QuestionType, 'reading'>

interface QuestionBase {
  /** Heading id, e.g. `Q1`; sub-questions of a reading block get `R1.1`, `R1.2`… */
  id: string
  prompt: string
  explain?: string
  hint?: string
  /** The vocabulary word this question checks (`word:` in the test file); mistakes mark that word as difficult. */
  word?: string
  topics: string[]
  /** 1-based line in the source file where the question starts. */
  line: number
}

export interface ChoiceQuestion extends QuestionBase {
  type: 'choice'
  options: string[]
  answer: string
  /** Keep the options in the listed order (a shared word bank must look the same for every gap). */
  keepOrder?: boolean
}

export interface TextQuestion extends QuestionBase {
  type: 'gap' | 'transform' | 'error'
  /** All accepted answers (the `|` alternatives). The first one is the "main" answer. */
  answers: string[]
  /** A spelling slip counts as correct (vocabulary questions; grammar tests stay exact). */
  typoTolerant?: boolean
  /** Other real forms of the same word (give up / gave up / giving up): typing one of them is a wrong form, not a typo. */
  otherForms?: string[]
}

export interface OrderQuestion extends QuestionBase {
  type: 'order'
  /** Chunks in the correct order. The UI shuffles them. */
  chunks: string[]
  /** Accepted full sentences (defaults to the chunks joined by spaces). */
  answers: string[]
}

export interface MatchQuestion extends QuestionBase {
  type: 'match'
  pairs: { left: string; right: string }[]
}

export type TfValue = 'true' | 'false' | 'not given'

export interface TfQuestion extends QuestionBase {
  type: 'tf'
  answer: TfValue
  notGiven: boolean
}

export type SimpleQuestion = ChoiceQuestion | TextQuestion | OrderQuestion | MatchQuestion | TfQuestion

export interface ReadingPassage {
  id: string
  title: string
  passage: string
}

export interface ReadingBlock {
  type: 'reading'
  id: string
  title: string
  passage: string
  questions: SimpleQuestion[]
  line: number
}

/** One gradable step of a test: a simple question, optionally inside a reading passage. */
export type TestItem = SimpleQuestion & {
  /** Globally unique key: `<testId>#<questionId>`. */
  key: string
  testId: string
  testTitle: string
  reading?: ReadingPassage
}

export interface ParseIssue {
  severity: 'error' | 'warning'
  message: string
  line?: number
  questionId?: string
}

export interface ParsedTest {
  /** Path relative to `<content>/tests`. */
  id: string
  title: string
  topics: string[]
  description: string
  level?: string
  blocks: (SimpleQuestion | ReadingBlock)[]
  /** Flattened, gradable items (reading sub-questions are separate items). */
  items: TestItem[]
  issues: ParseIssue[]
  mtime: number
}

// ───────────────────────── Answers ─────────────────────────

/**
 * What the learner answered:
 * - choice / gap / transform / error / tf → string
 * - order → chunk indices (into `chunks`) in the order picked
 * - match → for every left item, the index of the chosen right item (-1 = none)
 */
export type UserAnswer = string | number[]

export interface CheckResult {
  correct: boolean
  /** Counted as correct despite a small spelling slip (the right spelling is shown). */
  typo?: boolean
  /** For match questions: how many pairs were right. */
  partial?: { right: number; total: number }
}

// ───────────────────────── Progress ─────────────────────────

/** full test · retry of an attempt's mistakes · mistakes bank · questions on one topic from all tests · test built from the learner's words */
export type AttemptMode = 'full' | 'retry' | 'mistakes' | 'topic' | 'words'

export interface QuestionResult {
  key: string
  questionId: string
  type: SimpleQuestionType
  topics: string[]
  correct: boolean
  /** True when the learner pressed "Count as correct". */
  overridden?: boolean
  /** The vocabulary word the question checks, when the test says so. */
  word?: string
  userAnswer: string
  correctAnswer: string
}

export interface Attempt {
  id: string
  testId: string
  testTitle: string
  mode: AttemptMode
  startedAt: string
  finishedAt: string
  completed: boolean
  total: number
  correct: number
  results: QuestionResult[]
}

export interface MistakeEntry {
  key: string
  item: TestItem
  /** Correct answers in a row since the last mistake. Leaves the bank at 2. */
  streak: number
  wrongCount: number
  lastWrongAt: string
  lastSeenAt: string
}

/** FSRS scheduling state of a card (ts-fsrs `Card`, with dates as ISO strings for JSON). */
export interface SrsCard {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  /** 0 New · 1 Learning · 2 Review · 3 Relearning */
  state: 0 | 1 | 2 | 3
  last_review?: string
}

export interface Deck {
  id: string
  name: string
  /** Tailwind-free hex colour for the deck dot. */
  color: string
  createdAt: string
}

export interface VocabEntry {
  id: string
  text: string
  translation: string
  explanation?: string
  /** Where the word came from; `file` = a Markdown file in `<workbook>/vocabulary/` (ref = its path). */
  source: { kind: 'note' | 'test' | 'other' | 'file'; title: string; ref?: string }
  context?: string
  createdAt: string
  updatedAt?: string
  deckId?: string
  tags: string[]
  /** Part of speech: noun, verb, phrasal verb, idiom… */
  pos?: string
  ipa?: string
  /** CEFR level A1–C2 */
  level?: string
  /** Short topic used for automatic grouping (e.g. "Work", "Travel"). */
  topic?: string
  examples?: string[]
  note?: string
  suspended?: boolean
  /** Marked difficult by mistakes in tests; clears after 2 correct test answers in a row. */
  trouble?: { misses: number; streak: number; lastMissAt: string }
  srs: SrsCard
}

/** What the renderer sends when saving a new word — SRS state and tags are filled in by the main process. */
export type VocabInput = Omit<VocabEntry, 'srs' | 'tags'> & { tags?: string[] }

export type ReviewMode = 'flashcard' | 'typing' | 'cloze' | 'choice'
export type ReviewModePref = ReviewMode | 'mixed'
/** FSRS grade: 1 Again · 2 Hard · 3 Good · 4 Easy */
export type SrsGrade = 1 | 2 | 3 | 4

export interface VocabReviewLog {
  entryId: string
  grade: SrsGrade
  mode: ReviewMode
  at: string
  /** Card state before this review (0 = it was a new card). */
  prevState: number
  durationMs?: number
}

export interface Enrichment {
  pos: string
  ipa: string
  level: string
  topic: string
  examples: string[]
  translation: string
}

// ───────────────────────── Settings / translation ─────────────────────────

export type ThemePref = 'system' | 'light' | 'dark'
export type TranslationProvider = 'deepl' | 'claude' | 'gemini'

export interface Settings {
  contentDir: string | null
  theme: ThemePref
  provider: TranslationProvider
  claudeModel: string
  geminiModel: string
  autoTranslate: boolean
  /** Random question order in tests (reading passages keep their questions together). */
  shuffleQuestions: boolean
  /** Random order of multiple-choice options. */
  shuffleAnswers: boolean
  /** Show a question's topic before it is answered (it can give the answer away). */
  showTopics: boolean
  /** A one-letter spelling slip in a vocabulary question counts as correct. */
  forgiveTypos: boolean
  /** Look for a newer release on GitHub at startup (once a day at most). */
  checkUpdates: boolean
  /** Language of AI feedback on writing and chats (the corrected English stays English). */
  feedbackLanguage: 'uk' | 'en'
  /** Short tips about mistakes while chatting in a correspondence exercise. */
  chatTips: boolean
  /** FSRS target probability of remembering a card when it is due (0.8–0.97). */
  desiredRetention: number
  newCardsPerDay: number
  reviewsPerDay: number
  reviewMode: ReviewModePref
  defaultDeckId: string | null
  speakWords: boolean
  /** Name of the macOS voice used for pronunciation (null = pick automatically). */
  voiceName: string | null
  /** The guided tour has been completed or skipped. */
  tourDone: boolean
}

export interface SecretsStatus {
  deepl: boolean
  claude: boolean
  gemini: boolean
  encryptionAvailable: boolean
}

// ───────────────────────── Writing ─────────────────────────

export type WritingCriterion = 'content' | 'style' | 'vocabulary' | 'grammar'
export const MISTAKE_CATEGORIES = ['grammar', 'tense', 'article', 'preposition', 'word order', 'vocabulary', 'spelling', 'punctuation', 'style'] as const
export type MistakeCategory = (typeof MISTAKE_CATEGORIES)[number]

export interface WritingCorrection {
  /** Exactly as it stands in the learner's text. */
  original: string
  corrected: string
  explanation: string
  category: MistakeCategory
}

export interface WritingEvaluation {
  /** 0–5 for each criterion. */
  scores: Record<WritingCriterion, number>
  /** 0–100, calculated from the four scores by the app (not by the AI). */
  overall: number
  cefr: string
  summary: string
  strengths: string[]
  improvements: string[]
  corrections: WritingCorrection[]
  /** The learner's text rewritten without the mistakes. */
  improved: string
  targetWords: { word: string; used: boolean; correct: boolean; note: string }[]
  provider: TranslationProvider
  evaluatedAt: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** A short note about a mistake in this (user) message, when tips are on. */
  tip?: string
  at: string
}

/** An essay or a correspondence exercise (kept together: one history, one evaluation format). */
export interface WritingEntry {
  id: string
  kind: 'essay' | 'chat'
  title: string
  /** Essay: the task (Markdown). Chat: the situation shown to the learner. */
  prompt: string
  taskId?: string
  /** 'YYYY-MM' of the day it was started. */
  month: string
  createdAt: string
  updatedAt: string
  status: 'draft' | 'evaluated'
  /** Words from the learner's vocabulary to try to use. */
  targetWords: string[]
  // essay
  text: string
  minWords?: number
  maxWords?: number
  // chat
  scenarioId?: string
  aiRole?: string
  register?: 'formal' | 'informal'
  goals?: string[]
  messages: ChatMessage[]
  /** The partner wrapped up the conversation: time to ask for feedback. */
  chatDone?: boolean
  evaluation?: WritingEvaluation
}

/** What the window sends to start an essay or a conversation. */
export type NewWritingEntry = Pick<WritingEntry, 'kind' | 'title' | 'prompt' | 'taskId' | 'targetWords' | 'minWords' | 'maxWords' | 'scenarioId' | 'aiRole' | 'register' | 'goals'> & {
  /** The partner's first message (a conversation that does not start with the learner). */
  opening?: string
}

export type WritingResult = { ok: true; entry: WritingEntry } | { ok: false; code: TranslateErrorCode; message: string }

export type TranslateErrorCode = 'no-key' | 'offline' | 'quota' | 'auth' | 'rate-limit' | 'too-long' | 'unknown'

export type TranslateResult =
  | {
      ok: true
      translation: string
      explanation?: string
      provider: TranslationProvider
      cached: boolean
    }
  | { ok: false; code: TranslateErrorCode; message: string }

export interface ContentChangeEvent {
  kind: 'notes' | 'tests' | 'all'
}

/** A short text with a numbered gap `{n}` for every word; `form` is what goes into the gap. */
export interface ReadingGapText {
  title: string
  passage: string
  gaps: { n: number; entryId: string; form: string }[]
}

export type ReadingTextResult = ({ ok: true; provider: TranslationProvider } & ReadingGapText) | { ok: false; code: TranslateErrorCode; message: string }

/** Result of importing `<workbook>/vocabulary/*.md`. */
export interface VocabSyncSummary {
  added: number
  updated: number
  /** Words in the files that were already in the library (merged, not duplicated). */
  existing: number
  files: { id: string; items: number; issues: { line: number; message: string }[] }[]
  /** Names of files that changed in this sync (for the notification). */
  changed: string[]
}

// ───────────── Irregular verbs ─────────────

/** 1 all three forms equal · 2 V2 = V3 · 3 V1 = V3 · 4 V1 = V2 · 5 all different · 6 rare/literary · 7 two correct variants (learnt/learned). */
export type IrregularGroup = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface IrregularVerb {
  id: string
  v1: string
  /** Several correct forms are written "burnt / burned". */
  v2: string
  v3: string
  uk: string
  group: IrregularGroup
  /** Rank among the 60 most frequent irregular verbs. */
  top?: number
}

/** FSRS card of every verb that was started, keyed by verb id (`<workbook>/.workbook/irregular.json`). */
export type IrregularProgress = Record<string, SrsCard>
