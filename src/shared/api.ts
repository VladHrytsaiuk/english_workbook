import type {
  Attempt,
  Deck,
  ReviewMode,
  SrsGrade,
  VocabInput,
  NewWritingEntry,
  WritingEntry,
  WritingResult,
  VocabReviewLog,
  ReadingTextResult,
  VocabSyncSummary,
  ContentChangeEvent,
  MistakeEntry,
  NoteDoc,
  ParsedTest,
  SecretsStatus,
  Settings,
  TestItem,
  TranslateResult,
  TranslationProvider,
  VocabEntry
} from './types'

/** The API exposed to the renderer as `window.api` (see src/preload/index.ts). */
export interface WorkbookApi {
  platform: string
  settings: {
    get(): Promise<Settings>
    update(patch: Partial<Settings>): Promise<Settings>
  }
  content: {
    defaultDir(): Promise<string>
    chooseFolder(): Promise<string | null>
    /** Creates notes/ and tests/ (+ examples on first use), saves the folder in settings, starts watching. */
    setup(dir: string): Promise<{ created: string[]; settings: Settings }>
    notes(): Promise<NoteDoc[]>
    tests(): Promise<ParsedTest[]>
    openFolder(sub?: 'vocabulary' | 'tests' | 'writing'): Promise<void>
    /** Opens a format spec (TEST_FORMAT.md / VOCAB_FORMAT.md / NOTES_FORMAT.md) from the workbook in the default editor. */
    openSpec(name: 'TEST_FORMAT.md' | 'VOCAB_FORMAT.md' | 'NOTES_FORMAT.md'): Promise<void>
    revealFile(kind: 'notes' | 'tests', id: string): Promise<void>
    openFile(kind: 'notes' | 'tests', id: string): Promise<void>
    onChanged(cb: (e: ContentChangeEvent) => void): () => void
  }
  progress: {
    attempts(): Promise<Attempt[]>
    saveAttempt(attempt: Attempt, items: TestItem[]): Promise<void>
    deleteAttempt(id: string): Promise<void>
    mistakes(): Promise<MistakeEntry[]>
    removeMistake(key: string): Promise<void>
    clear(): Promise<void>
  }
  vocab: {
    list(): Promise<VocabEntry[]>
    /** Adds a word (or merges into an existing one with the same text, keeping its progress). */
    add(entry: VocabInput): Promise<VocabEntry>
    update(id: string, patch: Partial<VocabEntry>): Promise<VocabEntry | null>
    remove(ids: string[]): Promise<void>
    move(ids: string[], deckId: string | null): Promise<void>
    tag(ids: string[], add: string[], remove: string[]): Promise<void>
    suspend(ids: string[], suspended: boolean): Promise<void>
    reset(ids: string[]): Promise<void>
    review(id: string, grade: SrsGrade, mode: ReviewMode, durationMs?: number): Promise<VocabEntry | null>
    reviews(): Promise<VocabReviewLog[]>
    /** An AI-written short text that uses the given words once each, with a gap for every word. */
    readingText(ids: string[]): Promise<ReadingTextResult>
    /** Re-reads `<workbook>/vocabulary/*.md`. */
    sync(): Promise<VocabSyncSummary>
    onChanged(cb: (e: VocabSyncSummary) => void): () => void
    /** Fills part of speech, IPA, level, topic and examples with Gemini / Claude. */
    enrich(id: string): Promise<{ ok: true; entry: VocabEntry } | { ok: false; message: string }>
    exportCsv(ids?: string[]): Promise<string | null>
  }
  writing: {
    list(): Promise<WritingEntry[]>
    create(input: NewWritingEntry): Promise<WritingEntry>
    /** Autosave of an essay draft. */
    saveText(id: string, text: string): Promise<void>
    remove(id: string): Promise<void>
    /** AI feedback and scores for an essay or a conversation. */
    evaluate(id: string): Promise<WritingResult>
    /** Sends the learner's message; the partner's reply (and a tip about a mistake) is added to the entry. */
    chatTurn(id: string, text: string): Promise<WritingResult>
  }
  decks: {
    list(): Promise<Deck[]>
    create(name: string, color?: string): Promise<Deck>
    update(id: string, patch: Partial<Pick<Deck, 'name' | 'color'>>): Promise<void>
    remove(id: string): Promise<void>
  }
  translate: {
    run(text: string, context?: string): Promise<TranslateResult>
    test(provider: TranslationProvider): Promise<TranslateResult>
    clearCache(): Promise<number>
    cacheSize(): Promise<number>
  }
  secrets: {
    status(): Promise<SecretsStatus>
    set(provider: TranslationProvider, key: string): Promise<SecretsStatus>
    clear(provider: TranslationProvider): Promise<SecretsStatus>
  }
  app: {
    openExternal(url: string): Promise<void>
    setTheme(theme: Settings['theme']): Promise<void>
    version(): Promise<string>
    dataDir(): Promise<string>
    openDataDir(): Promise<void>
  }
}
