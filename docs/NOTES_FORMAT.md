# EnglishWorkbook — Notes Format

Notes are your cheat sheets: grammar rules, tables, lists of phrases. Each note is a Markdown (`.md`) file in the
`notes/` folder of your workbook. Create or edit them in any text editor (TextEdit, VS Code, Obsidian, Typora…) —
the app picks up changes instantly.

Give this document to an AI assistant with a request like *"Make a cheat sheet about articles (a / an / the) in this
format"* and save the answer as `notes/articles.md`.

## Quick start

1. Open the workbook folder (Help → *Open the workbook folder*) and go into `notes/`.
2. Create a file, e.g. `modal-verbs.md`.
3. Paste:

```markdown
---
title: Modal Verbs
tags: [grammar, modals]
---

# Modal Verbs

**Modal verb + base form** (no *to*, no *-s*): *She **can** swim.*

| Modal | Meaning | Example |
|---|---|---|
| can | ability, permission | I **can** drive. |
| must | strong obligation | You **must** wear a seatbelt. |
| should | advice | You **should** see a doctor. |
```

4. Save — the note appears in **Notes**.

## Files and folders

- Any `.md` file inside `notes/` is a note. **Subfolders are allowed** (`notes/grammar/articles.md`), so you can group
  notes by theme; the path is shown under the title.
- Files and folders starting with a dot are ignored.
- Notes are sorted by title. Search (`⌘F` / `Ctrl+F`) looks through titles, tags and the full text.

## Frontmatter (optional)

The block between the two `---` lines at the very top:

| Key | Meaning |
|---|---|
| `title` | Title shown in the list. Without it: the first `# Heading`, then the file name. |
| `tags` | List of tags, e.g. `[grammar, tenses]` — shown under the title in the list and found by search. |

## What you can use inside a note

All standard Markdown plus GitHub tables:

| You write | You get |
|---|---|
| `# Title`, `## Section`, `### Subsection` | headings (use `##` for the main sections) |
| `**bold**`, `*italic*` | **bold**, *italic* — great for highlighting the verb form |
| `~~wrong~~ → right` | ~~strikethrough~~ — handy for common mistakes |
| `- item` / `1. item` | bulleted / numbered lists |
| `> text` | a highlighted quote box — rules, tips, warnings |
| `` `code` `` and ```` ``` ```` blocks | monospaced text — formulas like `have/has + V3` |
| `\| a \| b \|` tables | tables with a header row (see the example) |
| `- [ ] task` | a checklist |
| `[text](https://…)` | a link (opens in your browser) |
| `![alt](https://…/image.png)` | an image **from the internet** (images from local files are not shown) |
| `---` on its own line | a horizontal divider |

## Tips

- **Select any English text in a note** to translate it and save words to your vocabulary — so write examples as
  full English sentences; the sentence is saved together with the word.
- Ukrainian explanations are fine (e.g. an extra column *Українською*).
- Tables are the clearest way to compare forms (tenses, active vs passive, irregular verbs).
- Keep one topic per note and split long topics into `##` sections.

## Checklist for generating a note (for AI assistants)

1. Start with frontmatter: `title:` and `tags:` (lower-case topics, e.g. `[grammar, articles]`).
2. Then a `# Title` and a one- or two-sentence summary of the rule.
3. Use `##` sections; put forms and comparisons into tables with a header row.
4. Give natural English example sentences in *italics* with the key form in **bold**.
5. Add a `## Common mistakes` section with `~~wrong~~ → **right**` lines.
6. Short Ukrainian notes in brackets or in a separate column are welcome.
7. Output only the Markdown file content.

## Complete example

```markdown
---
title: Articles — a, an, the
tags: [grammar, articles]
---

# Articles — a, an, the

Use **a / an** for one thing that is new or not specific, **the** for something specific or already known.

## a or an?

| Article | Before | Example |
|---|---|---|
| a | a consonant **sound** | *a book, a university* |
| an | a vowel **sound** | *an apple, an hour* |

> It's about the **sound**, not the letter: *a **u**niversity* (/juː/), *an **h**our* (silent h).

## When to use *the*

- Something already mentioned: *I bought **a** car. **The** car is red.*
- Only one exists: ***the** sun, **the** Internet*
- Superlatives: *It's **the** best film I've seen.*

## No article

- Plural or uncountable nouns in general: *I like **music**. **Dogs** are loyal.*
- Meals, languages, most countries: *have **breakfast**, speak **English**, live in **Ukraine***

## Common mistakes

1. ~~She is teacher.~~ → She is **a** teacher. *(jobs need a / an)*
2. ~~The life is beautiful.~~ → **Life** is beautiful. *(general idea — no article)*
3. ~~I play the football.~~ → I play **football**. *(sports — no article)*
```
