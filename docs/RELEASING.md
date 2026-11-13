# Sharing the app and releasing updates

## One-time setup

1. Create an empty repository on GitHub (**public**, so that anyone can download releases without logging in), e.g. `your-name/english-workbook`.
2. Connect it and push (the first push also sends all tags):
   ```bash
   git remote add origin git@github.com:your-name/english-workbook.git
   git push -u origin main --follow-tags
   ```
3. Put the repository name into `src/shared/updates.ts`:
   ```ts
   export const UPDATE_REPO = 'your-name/english-workbook'
   ```
   While it is empty the app never asks the network about updates. Commit this change as part of the next release.
4. Install the GitHub CLI and log in once: `brew install gh && gh auth login`.

## Every release

```bash
# 1. bump "version" in package.json and package-lock.json, describe it in CHANGELOG.md, commit, tag
git tag -a v1.9.0 -m "1.9.0"
# 2. build the installers (tests run first)
env -u ELECTRON_RUN_AS_NODE npm run dist:all
# 3. push and publish: uploads the .dmg and .exe files, the CHANGELOG section becomes the release notes
git push --follow-tags
npm run release:publish
```

People who have the app see **“Update 1.9.0 available”** in the sidebar within a day (Settings → About → *Check now* does it at once).
The button opens the release page; they download the new installer and install it over the old one. Their notes, tests,
vocabulary and progress are in their workbook folder and are not touched.

## What the recipient should know

- **Mac:** the app is not signed with an Apple Developer certificate, so on first launch macOS says it cannot verify the developer.
  Open it with *right-click → Open → Open*, or, if the app is reported as damaged, run `xattr -cr /Applications/EnglishWorkbook.app` once.
- **Windows:** SmartScreen may say “Windows protected your PC”: *More info → Run anyway*. Prefer the `Setup` installer to the portable file.
- Everyone needs **their own Gemini key** (free, Settings → Translation). Keys are stored encrypted on that computer only.
- Windows can be given in-place automatic updates later (electron-updater); on macOS that needs a paid Apple Developer account,
  which is why the app only *tells* about updates for now.

## Before the very first push — checklist

- `git log -p | grep -E "AIza|AQ\.|sk-ant"` finds nothing (API keys must never be committed; the app stores them outside the repository).
- Large personal files are not tracked (`promo/` videos are in `.gitignore`; attach them to a release instead if you want to share them).
- Your own notes and vocabulary live in the workbook folder, not in this repository; `examples/` holds the sample content.
