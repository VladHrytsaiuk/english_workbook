# EnglishWorkbook — Vocabulary File Format

Put Markdown files with words into the `vocabulary/` folder of your workbook. The app picks them up instantly and
adds the words to your **Vocabulary** library, where they are reviewed with spaced repetition.

Give this document to an AI assistant with a request like *"Make a list of 30 B2 words about work in this format"*
and save the answer as `vocabulary/work.md`.

## Example

```markdown
---
deck: Work
tags: [b2]
---

- deadline — кінцевий термін
  > We have to meet the deadline by Friday.
- commute — дорога на роботу
  > My daily commute takes about an hour.
- to get along with — ладнати з
  > I get along well with my colleagues.
  > Do you get along with your boss?
  note: get along WITH somebody
- reliable — надійний #adjective
- eventually
```

## Rules

- **One word or phrase per list item**: `- word — translation`.
  The separator can be ` — `, ` – `, ` - `, ` = `, ` | ` or `: `.
- **Translation is optional.** If it is missing, the app translates the word itself (using your translation
  provider) and you can fill in details later with AI.
- **`> sentence`** on the next line(s), indented by two spaces: the first one is the sentence the word is used in —
  it is shown during review and used for *fill-the-gap* practice. Further `>` lines become examples.
  Write the word in the sentence **exactly as in the list item** (same form), so the gap can be found.
- **`note: …`** (indented): a personal note — collocations, a mnemonic, a warning.
- **`#tag`** at the end of an item adds a tag to that word.
- **Frontmatter** (optional):
  - `deck:` — the deck for all words in the file (created automatically if it doesn't exist).
  - `tags:` — tags added to every word, e.g. `[b2, exam]`.
  - `topic:` — a topic for grouping, e.g. `Work`.
- Headings, paragraphs and other Markdown are ignored, so you can add comments.

## How duplicates are handled

A word is never added twice. Case, spacing, punctuation, curly apostrophes and a leading *to* / *a* / *an* / *the*
are ignored when comparing — `To give up`, `give up` and `give up!` are the same word.

- A word that is **already in your library** (saved from a note, a test or another file) is not duplicated:
  the file only fills in what is missing (translation, sentence, deck, examples, tags). Your learning progress is kept.
- If you **edit a line** in the file later, the new translation / sentence / note replaces the old one — progress is kept.
- Changes you make **in the app** are not overwritten until you change that line in the file.
- **Removing a line** from a file does not delete the word from your library (delete it in the app if you want).

After each change the app shows how many words were added, updated, or were already in your vocabulary.

## Checklist for generating a list (for AI assistants)

1. Start with frontmatter containing `deck:` (and optionally `tags:` / `topic:`).
2. One `- word — Ukrainian translation` per line; use the base form (infinitive without *to* is fine).
3. Under each word add one natural example sentence as `  > …` that contains the word in exactly the same form.
4. Give the most common meaning; for several meanings list 2–3 translations separated by commas.
5. Output only the Markdown file content.
