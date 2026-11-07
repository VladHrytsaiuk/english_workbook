# EnglishWorkbook — Test File Format (v1)

This document is the complete specification of the Markdown format used by EnglishWorkbook for tests.
Give it to an AI assistant together with a request like *"Create a test on the Present Perfect in this format"*,
then save the result as a `.md` file in the `tests/` folder of your workbook. The app picks it up instantly.

---

## 1. File structure

A test file has three parts:

1. **Frontmatter** — YAML between two `---` lines at the very top.
2. **Optional intro text** — any Markdown before the first question (shown on the test's start screen).
3. **Questions** — each one starts with a level-2 heading `## <id>` followed by `key: value` lines.

```markdown
---
title: Week 45 — Tenses
topics: [Present Perfect, Past Perfect, Passive]
level: B1
description: Short description shown in the test list.
---

Optional intro paragraph.

## Q1
type: choice
q: She ___ here since 2020.
options: [lives, has lived, is living, lived]
answer: has lived
explain: Since + a point in time and the action continues → Present Perfect.
```

### Frontmatter keys

| Key | Required | Meaning |
|---|---|---|
| `title` | recommended | Test title. Defaults to the first `# H1` or the file name. |
| `topics` | recommended | List of topics, e.g. `[Present Perfect, Passive]`. Used for statistics. |
| `level` | optional | Free text, e.g. `A2`, `B1–B2`. |
| `description` | optional | One sentence shown in the test list. |

### Question ids

- The text after `## ` is the question id: `## Q1`, `## Q2`, `## R1`… Any text works, but **every id must be unique** in the file.
- Keep ids stable when you edit a file — progress and the mistakes bank are linked to `file name + id`.
- Reading sub-questions get automatic ids `R1.1`, `R1.2`, …

---

## 2. Keys common to all question types

| Key | Required | Meaning |
|---|---|---|
| `type` | **yes** | One of `choice`, `gap`, `transform`, `error`, `order`, `match`, `tf`, `reading`. |
| `q` | yes (see each type) | The question / sentence / instruction. |
| `answer` | yes (except `match`) | The correct answer. For typed answers, separate alternatives with `|`. |
| `explain` | strongly recommended | Explanation shown **after** the learner answers. |
| `topic` | recommended | Topic of this question for statistics (overrides the file's `topics`). A list is allowed: `[Past Simple, Irregular verbs]`. |
| `word` | optional | The vocabulary word this question checks, e.g. `word: give up`. If the learner has that word saved, a mistake marks it as **difficult** (it appears under Vocabulary → Difficult and in word tests more often); two correct answers in a row clear the mark. Write the word exactly as in the learner's list, in its base form. Use it in vocabulary tests; leave it out of grammar questions and out of `match` questions that cover several words. |
| `hint` | optional | A hint the learner can reveal before answering. |

### Writing rules

- **One key per line.** Values of `q`, `answer`, `explain`, `hint`, `title` and `topic` are read *verbatim* to the end of the line — colons, `#`, quotes and dashes inside them are fine. No need for quotes.
- For multi-line text use YAML block style: `explain: |` and then indented lines.
- Lists are written in brackets `[a, b, c]` or as indented `- item` lines. If an item contains a comma, use the `- item` form or put the item in double quotes: `["Yes, I do", "No, I don't"]`.
- Blank lines between keys are allowed. Lines starting with `#` (not `##`) are comments.

### How typed answers are compared

For `gap`, `transform`, `error` and `order`, the learner's answer is compared with **every** `|` alternative after normalisation:
case-insensitive · leading/trailing spaces trimmed · multiple spaces collapsed · curly apostrophes and quotes (`’ “ ”`) treated as straight ones (`' "`) · a final `.`, `!` or `?` ignored.

So `answer: A bridge is being built.` accepts `a bridge is being built`. Contractions are **not** expanded automatically:
list them as alternatives if both should count (`answer: I have known him | I've known him`).
If a learner's answer is marked wrong but is actually fine, they can press **Count as correct**.

---

## 3. Question types

### 3.1 `choice` — single choice

```markdown
## Q1
type: choice
topic: Past Continuous
q: I ___ dinner when the phone rang.
options: [cooked, was cooking, have cooked, had cooked]
answer: was cooking
explain: A longer action in progress (Past Continuous) interrupted by a short one (Past Simple).
```

- `options` — 2 or more options (keyboard shortcuts 1–9 work for the first nine).
- `answer` — the exact text of the correct option. (A letter `b` or a 1-based number `2` is also accepted.)

**Linking a question to a vocabulary word** (optional, for vocabulary tests):

```markdown
## Q1
type: gap
topic: Vocabulary
word: deadline
q: We have to meet the ___ by Friday.
answer: deadline
explain: A deadline is the last moment to finish something (кінцевий термін).
```

### 3.2 `gap` — fill in the gap

```markdown
## Q2
type: gap
topic: Past Perfect
q: By the time we arrived, the film ___ (already / start).
answer: had already started | had started
explain: An action before another past action → Past Perfect: had + V3.
```

- Mark the gap with `___` (three or more underscores). One input field is shown for the whole answer.
- `answer` — the missing word(s); several accepted answers separated by `|`.

### 3.3 `transform` — rewrite the sentence

```markdown
## Q3
type: transform
topic: Passive
q: Rewrite in the Passive: They are building a bridge.
answer: A bridge is being built. | A bridge is being built by them.
explain: Present Continuous passive = am/is/are + being + V3.
hint: Start with "A bridge…"
```

- `q` — the instruction plus the original sentence.
- `answer` — the full rewritten sentence; alternatives with `|`.

### 3.4 `error` — find and correct the mistake

```markdown
## Q4
type: error
topic: Present Perfect
q: I am knowing him for ten years.
answer: I have known him for ten years. | I've known him for ten years.
explain: "Know" is a stative verb, and "for ten years" up to now needs Present Perfect.
```

- `q` — a sentence that contains **one** mistake. The app pre-fills the input with this sentence so the learner can edit it.
- `answer` — the fully corrected sentence; alternatives with `|`.

### 3.5 `order` — put the words in order

```markdown
## Q5
type: order
topic: Present Perfect
q: Put the words in the correct order.
chunks: [Have, you, ever, been, to London?]
explain: Present Perfect question: Have + subject + ever + V3.
```

- `chunks` — the words / chunks **in the correct order**. The app shuffles them. A chunk may contain several words (`to London?`).
- `answer` *(optional)* — accepted sentences if more than one order is correct, separated by `|`. If omitted, the correct answer is the chunks joined with spaces. Every alternative must use exactly the words from `chunks`.
- `q` *(optional)* — defaults to "Put the words in the correct order."
- Short form: `answer: I / have never been / to Paris` (chunks separated by `/`, no `chunks:` key).

### 3.6 `match` — match pairs

```markdown
## Q6
type: match
topic: Formulas
q: Match each tense with its formula.
pairs:
  - Present Perfect: have/has + V3
  - Past Continuous: was/were + V-ing
  - Future Perfect: will have + V3
  - Past Perfect: had + V3
explain: Perfect = have + V3; Continuous = be + V-ing.
```

- `pairs` — 2 or more pairs, one per line as `- left: right`. The right side is shuffled in the app.
- Alternatives for a pair line: `- left = right` or `- left -> right`.
- Left sides must be unique. The question counts as correct only if **all** pairs are right (partial score is shown).
- No `answer` key — the pairs are the answer.

### 3.7 `tf` — True / False (/ Not Given)

```markdown
## Q7
type: tf
topic: Present Perfect
q: "I have seen him yesterday" is a correct sentence.
answer: false
explain: With a finished time expression (yesterday) use Past Simple.
```

- `answer` — `true`, `false` or `not given`.
- The **Not Given** button is shown automatically when the answer is `not given`. To show it for a true/false statement as well (so it is not a giveaway), add `notgiven: true`.
- Keyboard: `1`/`T` = True, `2`/`F` = False, `3`/`N` = Not Given.

### 3.8 `reading` — reading comprehension

```markdown
## R1
type: reading
title: A Day in London
passage: |
  When Olena first moved to London in 2019, she didn't know anyone.
  She had studied English at school for eleven years.

  Today she works as a designer and has lived in London for six years.
questions:
  - type: choice
    q: Before 2019, Olena…
    options: [had lived in London, had studied English, was a designer]
    answer: had studied English
    explain: "She had studied English at school…" — Past Perfect.
  - type: tf
    q: Olena has a lot of friends in London.
    answer: not given
    explain: The text doesn't say.
  - type: gap
    q: Olena ___ in London for six years.
    answer: has lived | has been living
    explain: Present Perfect + for.
```

- `passage` — the text, written with `|` and indented by two spaces. Blank lines make paragraphs. Simple Markdown (`**bold**`, `*italic*`) is allowed.
- `title` *(optional)* — shown above the passage.
- `questions` — a list of sub-questions. Each item starts with `- type:` and may use **any type except `reading`**. Indent the keys of each item to line up under `type`.
- The passage is shown on the left, the current sub-question on the right. **Each sub-question counts separately** in the score and statistics.
- `topic` on the reading block applies to all its sub-questions unless they set their own.

---

## 4. Validation

When a file is malformed, the app shows it in the Tests list with a red badge and lists each problem with its line number, for example:

- `Q3 · line 18 — Missing answer:. Separate several accepted answers with |.`
- `Q5 · line 27 — answer: c is not one of the options [a, b].`
- `Q9 · line 40 — Unknown type essay.`

Questions that are valid can still be practised ("Start with N valid questions"). Warnings (yellow) do not block anything —
e.g. an unknown key such as `explian:` (typo) or a `gap` question without `___`.

---

## 5. Checklist for generating a test (for AI assistants)

1. Start with frontmatter containing `title` and `topics`.
2. Number questions `## Q1`, `## Q2`, … and reading blocks `## R1`, `## R2`, …; never repeat an id.
3. Every question has `type`, `q` (except `match`/`order`, where it is optional), `answer` (except `match`), `explain`, and ideally `topic`.
4. In `choice`, `answer` must be copied exactly from `options`.
5. In `gap`, mark the gap with `___` and put the base verb in brackets when useful: `(already / start)`.
6. In typed answers, list all reasonable alternatives with `|`, including contracted forms.
7. In `order`, list `chunks` in the correct order — the app shuffles them.
8. In `match`, write `pairs` as `- left: right`, one per line, with unique left sides.
9. In `tf`, use `true`, `false` or `not given`.
10. In `reading`, write `passage: |` with the text indented two spaces, then `questions:` with `- type:` items.
11. Write explanations in clear, simple English (a short Ukrainian note in brackets is fine).
12. Output only the Markdown file content.

---

## 6. Complete example (all 8 types)

```markdown
---
title: Week 46 — Mixed Tenses
topics: [Present Perfect, Past Simple, Passive, Future]
level: B1
---

## Q1
type: choice
topic: Present Perfect
q: I ___ this film three times.
options: [saw, have seen, see, had seen]
answer: have seen
explain: Experience up to now, no finished time → Present Perfect.

## Q2
type: gap
topic: Past Simple
q: We ___ (go) to Lviv last summer.
answer: went
explain: "Last summer" is a finished time → Past Simple. go → went.

## Q3
type: transform
topic: Passive
q: Rewrite in the Passive: People speak English all over the world.
answer: English is spoken all over the world.
explain: Present Simple passive = am/is/are + V3.

## Q4
type: error
topic: Future
q: If it will rain tomorrow, we will stay at home.
answer: If it rains tomorrow, we will stay at home. | If it rains tomorrow, we'll stay at home.
explain: First conditional — Present Simple after "if", not will.

## Q5
type: order
topic: Present Perfect
chunks: [She, has, just, finished, her homework]
explain: "Just" goes between have/has and V3.

## Q6
type: match
topic: Formulas
q: Match the tense with the example.
pairs:
  - Past Simple: I worked
  - Present Perfect: I have worked
  - Past Perfect: I had worked
explain: V2 / have + V3 / had + V3.

## Q7
type: tf
topic: Past Simple
q: The past form of "bring" is "brang".
answer: false
explain: bring → brought → brought.

## R1
type: reading
title: The New Bridge
passage: |
  A new bridge is being built across the river. Work started in 2023,
  and the bridge will have been finished by next spring.
questions:
  - type: tf
    topic: Passive
    q: The bridge is already finished.
    answer: false
    explain: '"is being built" — the work is still in progress.'
  - type: gap
    topic: Future
    q: The bridge will ___ (finish) by next spring.
    answer: have been finished
    explain: Future Perfect passive = will have been + V3.
```
