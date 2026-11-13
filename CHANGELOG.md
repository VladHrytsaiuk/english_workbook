# Changelog

All notable changes to EnglishWorkbook. Versions follow [semantic versioning](https://semver.org/):
`MAJOR.MINOR.PATCH` — new features bump MINOR, fixes bump PATCH. The version lives in `package.json`
and is shown in Settings → About and in the `.dmg` file name.

## [1.9.0] — 2026-11-13

### Added
- **Update notice**: once a day (can be turned off in Settings → About) the app asks GitHub Releases for the latest version and, when
  there is a newer one, shows *Update X available* in the sidebar with a link to the download; *Check now* in Settings does it at once.
  It stays silent until `UPDATE_REPO` in `src/shared/updates.ts` is set.
- `npm run release:publish` uploads the installers to GitHub Releases with the CHANGELOG section as notes; `docs/RELEASING.md`
  describes publishing, updating and what a recipient should know (unsigned app warnings, own Gemini key). MIT `LICENSE`.

## [1.8.1] — 2026-11-13

### Fixed
- **Answers given after leaving a test and coming back were not counted**: moving to another page saved the half-finished test
  as finished, and the final save was skipped, so the mistakes bank kept questions you had already answered correctly. A test now
  saves once, when it really ends.

## [1.8.0] — 2026-11-09

### Added
- **Irregular verbs** (new section, `⌘6`; Stats moved to `⌘7`): 180 verbs from the irregular-verbs note, in seven groups by the pattern of
  their forms, the 60 most frequent first. Practice: the infinitive is shown and you type V2 and V3 (exact spelling; "was / were" accepts
  either); wrong verbs return a few cards later; FSRS schedules the rest. Scopes: top 60, all, one group, weak verbs; 5/10/20 new per
  session. *Reference* tab: searchable table with a **Cover V2 & V3** self-test mode. A plan item on Today when verbs are due; a tour step.
- **Find in note** (`⌘F`): searches inside the open note with "n of m", next/previous (`↵`, `⇧↵`) and the current match highlighted.
  Searching the list of notes moved to `⌘K` (and `/`).

### Fixed
- **A test is no longer ended when you open another page** (e.g. the notes to look something up). It stays paused with its answers, and a
  *Test in progress* button in the sidebar brings you back. Only *Exit* or the results screen close it.

## [1.7.0] — 2026-11-08

### Added
- **Writing** (new section, `⌘5`; Stats moved to `⌘6`):
  - **Writing of the month**: a task from a bank of 24 (emails, opinions, descriptions, stories, reviews) or your own topic,
    with up to 5 of your practised words to try to use (any grammatical form counts). An editor with a word counter and
    automatic drafts. An AI checks the text on four criteria (0–5), the percentage is calculated by the app, with a CEFR level,
    strengths, priorities, the text with the mistakes marked, corrections with explanations and a corrected version.
  - **Correspondence**: 10 real-life situations (landlord, interview, restaurant complaint, hotel, doctor…) or your own.
    An AI plays the other person, gives a short tip under a message that has a clear mistake, and evaluates the conversation at the end.
  - A history with scores over time, your most common kinds of mistakes, and a Markdown copy of every checked text in `writing/`.
  - A "Writing of the month" item in Today's plan until it is done.
- Settings → Writing: language of the feedback (Ukrainian / English) and tips while chatting.

### Notes
- The AI's answer is checked before it is shown: a correction is kept only if its quote really is in your text, scores are
  clamped to 0–5, and which target words you used is decided by the app. The score is feedback, not an exam result.

## [1.6.0] — 2026-11-08

### Added
- **`word:` in test files** links a question to a vocabulary word (`word: give up`). A mistake marks that word as
  **difficult**: it appears under Vocabulary → Difficult, comes up more often in word tests, and the word's card says why.
  Two correct test answers in a row clear the mark. Tests never change the spaced-repetition schedule.
  The match is forgiving (case, punctuation, a leading *to*, and grammatical forms: `word: giving up` finds "to give up").
- **Words behind your mistakes**: the results screen lists the saved words whose questions you got wrong, with a
  **Review these words** button.
- Word tests made by the app carry `word:` too, so their mistakes mark words in the same way. The *AI prompt* now asks the chat
  to add `word:` to every question about a word of yours; `docs/TEST_FORMAT.md` documents the key.

## [1.5.0] — 2026-11-08

### Added
- **Grammatical forms of your words.** The gap finder now recognises other forms of a saved word, so "give up" is found in
  "She is giving up", "He gave up" and "They have given up" (regular endings by rule, ~110 common irregular verbs listed).
- **Use the right form** (new word-test question type): a sentence with a gap and the base word in brackets — *"He ___
  smoking last year. (give up — здаватися)"* — where only the exact form that fits is accepted (*gave up*), not the base
  word. It uses the sentences saved with the word (the ones from "Fill with AI" are especially good for this).
- **Reading with gaps → "Typing the right form"**: the text shows the base word in brackets after each gap and you type
  the correct form (*(give up)* → *giving up*), instead of choosing from a word bank.

### Changed
- "Fill the gap" and the cloze cards in review also work with inflected forms: when the sentence has another form, the base
  word is shown in brackets and that exact form is required.
- A different real form of the word is **never forgiven as a typo**: *give up* instead of *gave up* differ by one letter
  but are a grammar mistake. Typo tolerance only applies to genuine spelling slips.

## [1.4.1] — 2026-11-07

### Changed
- **Small typos are forgiven in word tests.** In the "write it in English" and "fill the gap" questions of a word test, one
  wrong, missing, extra or swapped letter in a word of 5+ letters (*documentaition* → *documentation*) counts as correct
  and shows the right spelling in an amber note. Grammar tests are unchanged and stay exact (*has* ≠ *had*).
  Settings → Tests → *Forgive small typos in word tests* (on by default).

## [1.4.0] — 2026-11-07

### Added
- **Reading with gaps** (Word test → *Reading with gaps*): AI writes a short text that uses 4, 6 or 8 of your words once
  each; you put every word into its gap from a shared word bank (plus one or two words that don't fit). Every gap counts
  separately. Without a key or internet it is built from the sentences you saved with the words. The bank shows words in
  lower case, so a capital letter doesn't reveal which gaps start a sentence.

### Changed
- **A word test now covers only words you have already practised** (reviewed at least once). New, never-reviewed words
  are left out unless you tick *Also include N new words I haven't reviewed yet*. The same applies to the Word test
  item on Today. If fewer than 4 words are practised, the dialog says so.

### Fixed
- A saved phrase with a leading *to* / article ("to give up") got no gap in a sentence that has only "give up". The
  leading word is now optional, in word tests and in review.

## [1.3.0] — 2026-11-07

### Added
- **Word tests**: a test made of your own vocabulary (Vocabulary → **Test**, Tests → **Word test**, and a "Word test"
  item in Today's plan). Choose the words (this view, not mastered yet, added this week, difficult, all), how many
  (10 / 20 / 30) and the question types: choose the translation, choose the English word, write it in English, fill
  the gap in the sentence where you found the word, build a sentence from an example, match pairs.
  Difficult words are asked more often; results, per-topic breakdown, "Retry mistakes only" and the mistakes bank work
  as in any test. A word test does **not** change the spaced-repetition schedule.
- **AI prompt** button: copies a ready prompt with your words (translations, parts of speech, the sentences you found
  them in) plus the full test format, so Claude / ChatGPT can write a vocabulary test for exactly your words; save the
  answer in the `tests/` folder.

### Changed
- Vocabulary header is a bit more compact to fit the new button.

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
