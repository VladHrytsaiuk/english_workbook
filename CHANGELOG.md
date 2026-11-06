# Changelog

All notable changes to EnglishWorkbook. Versions follow [semantic versioning](https://semver.org/):
`MAJOR.MINOR.PATCH` — new features bump MINOR, fixes bump PATCH. The version lives in `package.json`
and is shown in Settings → About and in the `.dmg` file name.

## [1.2.1] — 2026-11-06

### Fixed
- **Today → "Fix N mistakes"** kept asking to redo questions you had just corrected. Now a question answered
  correctly today counts as done for today (its second correct answer comes on another day), whether you
  practised it from the mistakes bank or with "Retry mistakes only" on the results screen. The plan shows only
  what still needs work, and says how many questions come back tomorrow.

## [1.2.0] — 2026-11-05

### Changed
- **Questions are shuffled** in every test session; the sub-questions of a reading passage stay together and in order.
- **Multiple-choice options are shuffled**, whatever order the test file lists them in. The order is fixed for the
  whole session, so going back to a question shows the same order.
- **The topic of a question is hidden until you answer** (it was a strong hint); it appears with the explanation.
- Settings → Tests: *Shuffle questions*, *Shuffle answer options* (both on by default) and *Show topic before
  answering* (off by default). The old "Shuffle answer options" setting (off by default) is replaced.

### Fixed
- Options could appear in a different order when returning to a question with ←.

## [1.1.1] — 2026-11-05

### Added
- `NOTES_FORMAT.md`: how to write notes — a ready-to-copy quick start, everything Markdown can do in a note,
  tips, a complete example and a checklist for generating cheat sheets with AI. Copied into the workbook folder
  (also for existing workbooks) and opened from Help, the empty Notes page and the tour.

### Changed
- Help dialog: a "How to write files" row with Notes / Tests / Word lists guides.

## [1.1.0] — 2026-11-04

### Added
- **Windows build**: an installer (`EnglishWorkbook-Setup-1.1.0.exe`) and a portable `.exe` (x64), built from the
  same code with `npm run dist:win` (or `npm run dist:all` for macOS + Windows).

### Changed
- Windows / Linux use the standard window frame (macOS keeps the inset title bar); the menu bar is hidden.
- Every `⌘` shortcut also works with `Ctrl`.

## [1.0.0] — 2026-11-04

First version.

### Content
- Workbook folder (default `~/EnglishWorkbook`) with `notes/`, `tests/` and `vocabulary/` Markdown files, watched live.
- Notes: list, full-text search with highlighting, Markdown rendering with GFM tables.
- Tests: 8 question types (choice, gap, transform, error, order, match, true/false/not given, reading),
  validation errors with line numbers, explanation after answering, "Count as correct", results with per-topic
  breakdown, "Retry mistakes only". Spec: `docs/TEST_FORMAT.md`.

### Learning
- **Today** page: daily plan (words to review, mistakes bank, weakest topic, a test to try), streak, activity heatmap.
- Vocabulary with decks, topics, tags, smart lists, bulk actions and CSV export.
- Spaced repetition with FSRS (`ts-fsrs`): flashcards, typing, fill-the-gap in your own sentence, multiple choice.
- Word lists from Markdown files in `vocabulary/` (spec: `docs/VOCAB_FORMAT.md`) with duplicate protection.
- Stats: accuracy over time and per topic, mistakes bank (leaves after 2 correct answers in a row), vocabulary forecast.

### Translation & AI
- Select-to-translate popover (EN → UK) in notes, tests and reading passages; save to vocabulary.
- Providers: Gemini (default, hedged requests across models), DeepL, Claude; automatic fallback between providers.
- AI enrichment of words (part of speech, IPA, level, topic, examples) and auto-grouping by topic.
- API keys encrypted with Electron `safeStorage`; translation cache.

### App
- Light / dark / system theme, keyboard-first, guided tour (Ukrainian) and Help dialog.
- Pronunciation with macOS voices (prefers Premium / high-quality voices; selectable).
- Learning data stored in `<workbook>/.workbook/` (migrated automatically from older locations).
