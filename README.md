# EnglishWorkbook

A personal English workbook for macOS and Windows: Markdown cheat sheets, interactive tests (8 question types), instant
EN → UK translation of any selected text, a vocabulary list and progress statistics with a mistakes bank.

All content lives in **plain Markdown files in a folder you choose** (default `~/EnglishWorkbook`), so you can
write or generate new notes and tests in any editor. The app watches the folder and updates instantly.

---

## Quick start

```bash
npm install
npm run dev          # run in development (hot reload)
```

Build a macOS installer:

```bash
npm run dist         # typecheck + unit tests + build → release/EnglishWorkbook-1.0.0-arm64.dmg
```

Open the `.dmg`, drag **EnglishWorkbook** to Applications. The app is not code-signed, so the first time
**right-click → Open** (or *System Settings → Privacy & Security → Open Anyway*).

### Windows

```bash
npm run dist:win     # → release/EnglishWorkbook-Setup-<version>.exe (installer) and EnglishWorkbook-<version>-portable.exe
npm run dist:all     # macOS .dmg + Windows .exe in one go
```

Both can be built on a Mac (no Windows machine needed). The `.exe` files are not code-signed, so Windows SmartScreen
shows *"Windows protected your PC"* the first time — click **More info → Run anyway**. On Windows, shortcuts use
`Ctrl` instead of `⌘`, the workbook folder defaults to `C:\Users\<you>\EnglishWorkbook`, API keys are encrypted with
Windows DPAPI, and pronunciation uses the installed Windows voices (Settings → Time & language → Speech).

> Running from a VS Code task/extension? VS Code may set `ELECTRON_RUN_AS_NODE=1`, which makes Electron start as
> plain Node. Run `unset ELECTRON_RUN_AS_NODE` first if the window doesn't appear.

### Other scripts

| Script | What it does |
|---|---|
| `npm run test` | Vitest unit tests for the test-file parser and the answer checker |
| `npm run typecheck` | TypeScript checks for main/preload and renderer |
| `npm run build` | Production build into `out/` |
| `npm run smoke -- notes` | Builds and drives the real app with Playwright, saving screenshots to `.smoke/shots` (scenarios: `basic`, `notes`, `tests`, `translate`, `keys`, `stats`; add `--fake` for a fake translation provider). Uses an isolated profile in `.smoke/`. |
| `npm run icon` | Re-renders `build/icon.png` |

---

## Using the app

### Today & the guided tour

The app opens on **Today**: a daily plan (review due words, fix the mistakes bank, practise your weakest topic with
questions on it from all tests, try a test you haven't taken), your day streak, a 12-week activity heatmap and recently
saved words. On first run a **guided tour** (in Ukrainian) walks through every section; it can be replayed from the
**?** button at the bottom of the sidebar or Settings → Help, which also lists keyboard shortcuts and opens the file
format specs.

### Content folder

```
~/EnglishWorkbook/
├── notes/             ← cheat sheets (*.md, subfolders allowed)
├── tests/             ← tests (*.md, subfolders allowed)
├── vocabulary/        ← word lists (*.md) imported into Vocabulary
├── writing/           ← readable copies of your checked texts and conversations
├── .workbook/         ← your progress: words, reviews, test results (managed by the app)
├── NOTES_FORMAT.md    ← how to write notes (with an example and an AI checklist)
├── TEST_FORMAT.md     ← the test-format spec (give it to Claude to generate tests)
└── VOCAB_FORMAT.md    ← the word-list format spec
```

On first run you pick the folder; the app creates `notes/` and `tests/` with examples
(`tenses.md`, `passive-voice.md`, and a test covering all 8 question types). Change the folder in **Settings**.

### Tests

The format is fully specified in [`docs/TEST_FORMAT.md`](docs/TEST_FORMAT.md) (a copy is placed in your workbook
folder). In short:

```markdown
---
title: Week 45 — Tenses
topics: [Present Perfect, Past Perfect, Passive]
---

## Q1
type: choice
q: She ___ here since 2020.
options: [lives, has lived, is living, lived]
answer: has lived
explain: Since + a point in time and the action continues → Present Perfect.
```

Types: `choice`, `gap`, `transform`, `error`, `order`, `match`, `tf`, `reading`.
A malformed file is shown with a red badge and a list of problems with line numbers; its valid questions can still be practised.

**Weekly workflow:** give `TEST_FORMAT.md` to Claude, ask *"Generate a test on … in this format"*, save the answer as
`tests/week-46.md` — it appears in the app immediately.

Typed answers are compared case-insensitively, ignoring extra spaces, curly vs straight apostrophes/quotes and a final
`.`/`!`/`?`; every `|` alternative is accepted. If an answer is marked wrong but is fine, press **Count as correct**.

### Translation

Select text in a note, a question, a reading passage or the results screen → a popover shows the Ukrainian translation
with **Save to vocabulary**. Configure in **Settings → Translation**:

- **Gemini** (default) — translation plus a grammar explanation in context. Create a free key at
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (any Google account, no card; a Gemini app
  subscription such as Google AI Plus is not needed and does not include API access). Default model
  `gemini-3.1-flash-lite`; `gemini-3.5-flash-lite` and `gemini-3.8-flash` are selectable.
  The Gemini free tier is erratic (the same call takes 1 s or 10 s, or answers 503 "high demand"), so the app starts a
  second model in parallel if the first hasn't answered within ~2 s (first answer wins), and if Gemini is down it falls
  back to any other provider that has a saved key.
- **DeepL** — translation only; paste your key (Free-plan keys ending in `:fx` use `api-free.deepl.com` automatically).
- **Claude** — translation plus a short grammar explanation in context (in Ukrainian). Model selectable
  (Opus 5.5 default, Sonnet 5.5, Haiku 5.5). Uses the server-side refusal fallback where supported.

Keys are encrypted with Electron `safeStorage` (macOS Keychain) and only ever decrypted in the main process; API calls
never happen in the renderer. Translations are cached locally (up to 3,000) to save quota. Errors (no key, invalid key,
offline, quota exceeded, rate limit) are shown in the popover with a clear message.

### Vocabulary (spaced repetition)

Words come from the translation popover, `⌘N`, or **Markdown files in `vocabulary/`**:

```markdown
---
deck: Work
---
- deadline — кінцевий термін
  > We have to meet the deadline by Friday.
- commute
```

The format is in [`docs/VOCAB_FORMAT.md`](docs/VOCAB_FORMAT.md) (also copied into the workbook). A word is **never added
twice**: case, spacing, punctuation and a leading *to / a / an / the* are ignored when comparing, a word that already
exists only gets missing details filled in, editing a line in a file updates the word (progress is kept), and removing a
line never deletes the word. The popover and the *Add* dialog say when a word is already saved. Missing translations
are filled automatically.

The library has:

- **Decks** you create (e.g. *Phrasal verbs*, *Work*); the popover remembers the deck to save into.
- **Topics** filled automatically: **Fill with AI** / **Auto-group with AI** asks Gemini or Claude for part of speech,
  IPA, CEFR level, a topic (reusing your existing topics) and example sentences.
- **Tags**, **sources** (notes / tests / manual) and smart lists: *Due now, New, Learning, Difficult, Mastered, Suspended*.
- Search, sorting, bulk actions (move, tag, fill with AI, suspend, reset, delete) and CSV export (Anki can import it).

**Review** (`R` or the *Review N* button) uses **FSRS** (via `ts-fsrs`): every word comes back right before you'd
forget it. Practice styles, mixed by default:

| Style | You see | You do |
|---|---|---|
| Flashcard | English word + the sentence you saved it from | recall, then reveal (`Space`) |
| Write it in English | the Ukrainian translation | type the English word |
| Fill the gap | **your own sentence** with the word blanked out | type the missing word |
| Choose the translation | the English word | pick 1 of 4 translations |

Grade with `1` Again · `2` Hard · `3` Good · `4` Easy (each button shows the next interval); typed answers are
checked automatically (a one-letter slip counts as *Hard*) and `↵` accepts the suggested grade. Words graded *Again*
come back in the same session. Settings → *Vocabulary review*: target memory (85/90/95 %), new words and reviews per
day, practice style, pronunciation (macOS voice). Stats shows mastered words, retention and a 14-day review forecast.

### Word tests

A test made of **your own words** you have **already practised** (new, never-reviewed words are left out unless you tick
the box in the dialog) (Vocabulary → **Test**, Tests → **Word test**, or the *Word test* item in Today's
plan). Pick the words (this view / not mastered yet / added this week / difficult / all), 10–30 of them, and the
question types: choose the translation, choose the English word, write it in English (a verb is accepted with or without
*to*), fill the gap in **the sentence where you found the word**, build a sentence from an example, and a matching round
(5 pairs per 8 words). Difficult words come up more often. Results, the per-topic breakdown (*Vocabulary · Work*…) and
the mistakes bank work as in any test, but a word test never changes the review schedule.

In the "write it in English" and "fill the gap" questions one spelling slip in a word of 5+ letters still counts
(*documentaition* → *documentation*; the right spelling is shown), switchable in Settings → Tests. Grammar tests stay
exact: *has* and *had* differ by one letter, so typos are never forgiven there.

**Grammar forms.** Gaps recognise other forms of a saved word: "give up" is found in *"She is giving up"* / *"He gave up"*.
The **Use the right form** question shows the base word in brackets (*"He ___ smoking last year. (give up)"*) and accepts
only the exact form (*gave up*) — the base word is a grammar mistake, never a "typo". In *Reading with gaps* you can choose
**Typing the right form** instead of the word bank. The more varied sentences a word has (*Fill with AI* adds examples with
different forms), the better this works.

**Reading with gaps** is a second format: AI writes a short text that uses 4, 6 or 8 of your words once each, and you put
every word into its gap from a word bank (with one or two extra words that don't fit). Without a key or internet the
exercise is built from the sentences you saved with the words.

**Linking a test to your vocabulary.** Any question can say which saved word it checks (`word: give up`, see
`TEST_FORMAT.md`). A mistake marks that word as **difficult** (Vocabulary → Difficult, more often in word tests, a note on its
card); two correct answers in a row clear the mark. The results screen lists *Words behind your mistakes* with a
**Review these words** button. This works for tests written by a chat as well as for word tests made by the app.

**AI prompt** copies a ready-to-paste prompt with your words (translation, part of speech, the sentence you found
them in) and the complete test format, so a chat that knows nothing about the app can write a vocabulary test for exactly
your words — save its answer as a `.md` file in `tests/`.

### Writing & correspondence

**Writing** (`⌘5`) has two parts:

- **Writing of the month**: a task (email, opinion, description, story or review — or your own topic), 120–200 words, with up to
  5 words from your vocabulary to try to use (*give up* is found in *gave up*). The draft is saved as you type. An AI (the
  provider you chose for translation: Gemini or Claude) evaluates it on **four criteria from 0 to 5** — task & ideas,
  organisation & style, vocabulary, grammar. The percentage is calculated by the app; the AI adds a CEFR level, strengths,
  priorities, **corrections with explanations** (marked in your text) and a corrected version. It also shows whether you used your
  target words correctly.
- **Correspondence**: choose a real-life situation (a message to a landlord, a job interview, a complaint, a doctor's appointment…)
  or describe your own. An AI plays the other person; with *Tips while chatting* on, a short note appears under a message
  with a clear mistake. *Finish & get feedback* evaluates the conversation in the same way.

Your most common kinds of mistakes and your scores over time are on the Writing page, and a readable Markdown copy of every
checked text goes to the `writing/` folder of your workbook. The feedback is in Ukrainian by default (Settings → Writing);
corrected English always stays English. The AI's answer is validated before it is shown (a correction is kept only if its quote
is really in your text), but the score is feedback to track your progress, not an exam result.

### Stats & mistakes bank

Accuracy over time and per topic, tests completed and a study streak. Every wrongly answered question goes into the
**mistakes bank**; practise only those from **Stats** or **Tests**. A question leaves the bank after **2 correct answers
in a row** (anywhere — normal tests count too). Each reading sub-question counts separately.

### Keyboard

| Keys | Action |
|---|---|
| `⌘1` … `⌘6`, `⌘,` | Today, Notes, Tests, Vocabulary, Writing, Stats, Settings |
| `⌘F` or `/` | Search notes / vocabulary |
| `↵` | Start test · check answer · next question |
| `1`–`9` | Pick an option / chunk (order) / match |
| `T` `F` `N` | True / False / Not Given |
| `←` `→` | Previous / next question |
| `H` | Show hint |
| `Backspace` | Undo last chunk (order) · clear row (match) |
| `R` | Retry mistakes (results screen) · start review (vocabulary) |
| `Space` / `1`–`4` / `S` | Reveal · grade · play the word (vocabulary review) |
| `Esc` | Exit test (progress is saved) · close popover |

---

## Data

**Learning data lives in the workbook**, in `<workbook>/.workbook/` — so it is backed up (and synced, e.g. via
iCloud Drive) together with your notes and tests:

| File | Content |
|---|---|
| `vocabulary.json` | saved words with deck, tags, details and FSRS state |
| `decks.json` | vocabulary decks |
| `vocab-reviews.json` | review history (for stats) |
| `writing.json` | your texts, conversations and their evaluations |
| `vocab-files.json` | what each `vocabulary/*.md` file contained last time (to detect edits) |
| `attempts.json` | every test attempt: date, test, mode, per-question result |
| `mistakes.json` | the mistakes bank (with a snapshot of each question) |

**Machine-local** data stays in `~/Library/Application Support/EnglishWorkbook/data/`: `settings.json`,
`secrets.enc.json` (API keys, **encrypted** with `safeStorage` for this Mac) and `translation-cache.json`.

Data from older versions is moved into `.workbook/` automatically on first start (the old files are kept with a
`.moved-to-workbook` suffix), and duplicate words are merged. Writes are atomic (temp file + rename), and files changed
on disk (e.g. by iCloud) are re-read. Don't open the app on two Macs at the same time with the same synced workbook —
the last one to save wins.

---|---|
| `settings.json` | folder, theme, provider, options |
| `attempts.json` | every attempt: date, test, mode, per-question result |
| `mistakes.json` | the mistakes bank (with a snapshot of each question) |
| `vocabulary.json` | saved words with deck, tags, details and FSRS state |
| `decks.json` | vocabulary decks |
| `vocab-reviews.json` | review history (for stats) |
| `translation-cache.json` | cached translations |
| `secrets.enc.json` | API keys, **encrypted** with `safeStorage` |

Writes are atomic (temp file + rename). Unfinished tests are saved too (marked *unfinished*).

---

## Project structure

```
src/
├── shared/              ← pure TypeScript, used by main + renderer + tests
│   ├── types.ts         ← data model
│   ├── api.ts           ← the typed window.api contract
│   ├── testParser.ts    ← Markdown test → questions + validation issues
│   └── answer.ts        ← answer normalisation & checking
├── main/                ← Electron main process
│   ├── index.ts         ← window, lifecycle
│   ├── ipc.ts           ← IPC handlers
│   ├── content.ts       ← content folder, examples, reading, chokidar watcher
│   ├── data.ts          ← settings, attempts, mistakes bank
│   ├── vocab.ts         ← words, decks, reviews, CSV
│   ├── storage.ts       ← atomic JSON files
│   ├── secrets.ts       ← safeStorage-encrypted API keys
│   └── translate.ts     ← Gemini / DeepL / Claude, cache, AI enrichment
├── preload/index.ts     ← contextBridge → window.api
└── renderer/src/        ← React UI
    ├── components/      ← Sidebar, Markdown, TranslatePopover, ui/ (shadcn-style)
    ├── pages/           ← Notes, Tests, Vocabulary, Stats, Settings, Setup
    │   └── run/         ← test runner, question types, results
    └── lib/             ← app state (store.tsx), utils
examples/                ← sample notes/tests copied into a new workbook
docs/NOTES_FORMAT.md     ← how to write notes (also copied into the workbook)
docs/TEST_FORMAT.md      ← test-format spec (also copied into the workbook)
docs/VOCAB_FORMAT.md     ← word-list format spec (also copied into the workbook)
tests/                   ← vitest unit tests
scripts/                 ← smoke-test driver, icon renderer
```

**Stack:** Electron 45 · electron-vite (Vite 8) · React 19 · TypeScript · Tailwind CSS + shadcn/ui-style components (Radix) ·
framer-motion · react-markdown + remark-gfm · gray-matter + js-yaml · chokidar · Recharts · Anthropic TypeScript SDK ·
Vitest · electron-builder.

Security: `contextIsolation`, `sandbox`, no `nodeIntegration`, a strict CSP, external links open in the browser,
file access limited to the content folder.
