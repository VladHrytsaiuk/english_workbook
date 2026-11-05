import { writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function ensureSetup(page) {
  const useDefault = page.getByRole('button', { name: /Use this folder/ })
  if (await useDefault.count()) {
    await useDefault.click()
    await page.waitForTimeout(800)
  }
}

export const scenarios = {
  async basic({ page, shot }) {
    await shot('start')
    await ensureSetup(page)
    await shot('after-setup')
  },

  async notes({ page, shot, contentDir }) {
    await ensureSetup(page)
    await page.keyboard.press('Meta+1')
    await shot('notes-light')
    await page.mouse.wheel(0, 900)
    await shot('notes-scrolled')
    await page.keyboard.press('Meta+f')
    await page.keyboard.type('since')
    await shot('notes-search')
    await page.keyboard.press('Escape')
    // live reload
    const f = join(contentDir, 'notes', 'zz-live.md')
    writeFileSync(f, '# Live reload works\n\nAdded while the app was running.\n')
    await sleep(900)
    const appeared = await page.getByText('Live reload works').count()
    console.log('live reload note appeared:', appeared > 0)
    rmSync(f)
    await sleep(900)
    console.log('live reload note removed:', (await page.getByText('Live reload works').count()) === 0)
    await page.getByRole('button', { name: 'Dark theme' }).click()
    await page.waitForTimeout(300)
    await shot('notes-dark')
    await page.getByRole('button', { name: 'System theme' }).click()
  }
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const press = async (page, ...keys) => {
  for (const k of keys) {
    await page.keyboard.press(k)
    await page.waitForTimeout(120)
  }
}
const typeAnswer = async (page, text, { clear = false } = {}) => {
  await page.waitForTimeout(200)
  if (clear) await page.keyboard.press('Meta+a')
  await page.keyboard.type(text)
  await page.waitForTimeout(80)
}
const clickChunk = (page, text) => page.locator('button').filter({ hasText: new RegExp('^\\d?\\s*' + esc(text) + '$') }).first().click()
const clickRight = (page, text) => page.locator('button').filter({ hasText: new RegExp('^\\d+\\s*' + esc(text) + '[A-Z]?$') }).first().click()

scenarios.tests = async ({ page, shot, contentDir }) => {
  await ensureSetup(page)
  await page.keyboard.press('Meta+2')
  await shot('tests-list')
  await page.getByText('Tenses — All Question Types').first().click()
  await shot('test-detail')
  await press(page, 'Enter')
  // Q1 choice wrong
  await shot('q1-choice')
  await press(page, '1', 'Enter')
  await shot('q1-wrong-feedback')
  await press(page, 'Enter', '2', 'Enter', 'Enter') // Q2 right
  await press(page, '2', 'Enter', 'Enter') // Q3 right
  // Q4 gap
  await shot('q4-gap')
  await typeAnswer(page, 'had already started')
  await press(page, 'Enter')
  await shot('q4-gap-correct')
  await press(page, 'Enter')
  // Q5 gap wrong then override
  await typeAnswer(page, 'boil')
  await press(page, 'Enter')
  await page.getByRole('button', { name: /Count as correct/ }).click()
  await shot('q5-overridden')
  await press(page, 'Enter')
  await typeAnswer(page, 'is sleeping') // Q6
  await press(page, 'Enter', 'Enter')
  await shot('q7-transform')
  await typeAnswer(page, 'a bridge is being built') // Q7
  await press(page, 'Enter', 'Enter')
  await typeAnswer(page, 'My bike was stolen last night') // Q8
  await press(page, 'Enter', 'Enter')
  await typeAnswer(page, 'I’ve been learning English for two years.') // Q9 curly apostrophe
  await press(page, 'Enter')
  await shot('q9-apostrophe')
  await press(page, 'Enter')
  await shot('q10-error-prefilled')
  await typeAnswer(page, 'I have known him for ten years', { clear: true }) // Q10
  await press(page, 'Enter', 'Enter')
  await press(page, 'Enter') // Q11 unchanged -> wrong
  await shot('q11-error-wrong')
  await press(page, 'Enter')
  // Q12 order
  await shot('q12-order')
  for (const c of ['Have', 'you', 'ever', 'been', 'to London?']) await clickChunk(page, c)
  await shot('q12-order-filled')
  await press(page, 'Enter')
  await shot('q12-order-checked')
  await press(page, 'Enter')
  // Q13 order wrong via keyboard
  await press(page, '1', '1', '1', '1', '1', 'Enter')
  await shot('q13-order-wrong')
  await press(page, 'Enter')
  // Q14 match, last two swapped
  await shot('q14-match')
  for (const r of ['have/has + V3', 'was/were + V-ing', 'will have + V3', 'am/is/are + being + V3', 'had + V3']) await clickRight(page, r)
  await shot('q14-match-filled')
  await press(page, 'Enter')
  await shot('q14-match-checked')
  await press(page, 'Enter')
  await press(page, 'f', 'Enter', 'Enter') // Q15
  await press(page, 't', 'Enter', 'Enter') // Q16
  // Reading
  await shot('r1-reading')
  await press(page, '2', 'Enter')
  await shot('r1-1-checked')
  await press(page, 'Enter', 't', 'Enter', 'Enter')
  await shot('r1-3-tf-ng')
  await press(page, 'f', 'Enter')
  await shot('r1-3-wrong')
  await press(page, 'Enter')
  await typeAnswer(page, 'has lived')
  await press(page, 'Enter', 'Enter')
  await press(page, '3', 'Enter', 'Enter')
  await page.waitForTimeout(1200)
  await shot('results')
  await page.mouse.move(700, 500)
  await page.mouse.wheel(0, 700)
  await shot('results-scrolled')
  await press(page, 'r')
  await shot('retry-run')
  await press(page, 'Escape')
  // malformed file
  writeFileSync(
    join(contentDir, 'tests', 'broken.md'),
    `---\ntitle: Broken example\ntopics: [Test]\n---\n\n## Q1\ntype: choice\nq: Pick one\noptions: [a, b]\nanswer: c\n\n## Q2\ntype: gap\nq: No gap here\n\n## Q3\ntype: tf\nq: Fine question\nanswer: true\nexplian: typo\n\n## Q3\ntype: essay\nq: dup\n`
  )
  await sleep(1000)
  await page.keyboard.press('Meta+2')
  await shot('tests-list-with-broken')
  await page.getByText('Broken example').first().click()
  await shot('broken-detail')
  rmSync(join(contentDir, 'tests', 'broken.md'))
}


scenarios.translate = async ({ page, shot, contentDir }) => {
  await ensureSetup(page)
  await page.keyboard.press('Meta+1')
  await page.getByText('Passive Voice').first().click()
  await sleep(400)
  await page.locator('article').getByText('transitive', { exact: false }).first().dblclick()
  await sleep(700)
  await shot('popover-note')
  const save = page.getByRole('button', { name: /Save to vocabulary/ })
  if (await save.count()) {
    await save.click()
    await shot('popover-saved')
  }
  await page.keyboard.press('Escape')
  writeFileSync(
    join(contentDir, 'tests', 'zz-reading.md'),
    `---\ntitle: ZZ reading\n---\n## R1\ntype: reading\ntitle: Short text\npassage: |\n  The museum was opened in 1990 and has been visited by millions of people since then.\n\n  It is being renovated at the moment.\nquestions:\n  - type: tf\n    q: The museum is closed forever.\n    answer: false\n`
  )
  await sleep(900)
  await page.keyboard.press('Meta+2')
  await page.getByText('ZZ reading').first().click()
  await sleep(400)
  await press(page, 'Enter')
  await sleep(400)
  await page.getByText('renovated', { exact: false }).first().dblclick()
  await sleep(700)
  await shot('popover-reading')
  if (await save.count()) await save.click()
  await press(page, 'Escape')
  await press(page, 'Escape')
  rmSync(join(contentDir, 'tests', 'zz-reading.md'))
  await page.keyboard.press('Meta+3')
  await sleep(400)
  await shot('vocab')
  await page.keyboard.press('Meta+,')
  await sleep(400)
  await shot('settings')
  await page.mouse.move(700, 500)
  await page.mouse.wheel(0, 700)
  await shot('settings-scrolled')
}

scenarios.keys = async ({ page, shot }) => {
  const p = async (label) => console.log(label, (await page.evaluate(() => window.api.settings.get())).provider)
  await ensureSetup(page)
  await page.evaluate(() => window.api.secrets.clear('deepl'))
  await page.reload()
  await sleep(800)
  await p('start')
  await page.keyboard.press('Meta+,')
  await sleep(400)
  await page.getByPlaceholder(/xxxxxxxx/).fill('00000000-0000-0000-0000-000000000000:fx')
  await p('filled')
  await page.getByRole('button', { name: 'Save', exact: true }).first().click()
  await sleep(500)
  await p('saved')
  await page.getByRole('button', { name: 'Test', exact: true }).first().click()
  await sleep(4000)
  await p('tested')
  await shot('deepl-test-result')
  await page.keyboard.press('Meta+1')
  await sleep(300)
  await p('nav')
  await page.locator('article').getByText('Every English tense').first().dblclick()
  await p('dblclicked')
  await sleep(3000)
  await p('after popover')
  await shot('popover-auth-error')
}


async function practiceBankOnce(page) {
  await page.keyboard.press('Meta+4')
  await sleep(500)
  await page.mouse.move(700, 300)
  await page.mouse.wheel(0, 600)
  await sleep(200)
  await page.getByRole('button', { name: /^Practice/ }).click()
  await sleep(500)
  for (let i = 0; i < 20; i++) {
    if (await page.getByText(/^(Perfect score|Excellent work|Good job|Getting there|Keep practising)/).count()) break
    const id = (await page.locator('main span.ml-auto').first().textContent())?.trim()
    if (id === 'Q1') await press(page, '2', 'Enter')
    else if (id === 'R1.3') await press(page, '3', 'Enter')
    else await page.getByRole('button', { name: /I don't know/ }).click()
    await sleep(150)
    await press(page, 'Enter')
    await sleep(250)
  }
}

scenarios.stats = async ({ page, shot }) => {
  await ensureSetup(page)
  const bank = async (l) => console.log(l, JSON.stringify((await page.evaluate(() => window.api.progress.mistakes())).map((m) => `${m.item.id}:${m.streak}`)))
  await bank('bank before')
  // Seed history across previous days
  await page.evaluate(async () => {
    const topics = ['Present Perfect', 'Past Simple', 'Passive', 'Future', 'Past Perfect']
    for (let d = 12; d >= 1; d -= 2) {
      const when = new Date(Date.now() - d * 86400000).toISOString()
      const results = Array.from({ length: 10 }, (_, i) => ({
        key: `seed-${d}#Q${i}`, questionId: `Q${i}`, type: 'gap', topics: [topics[i % 5]],
        correct: Math.random() < 0.45 + (12 - d) * 0.04, userAnswer: 'x', correctAnswer: 'y'
      }))
      await window.api.progress.saveAttempt({ id: `seed-${d}`, testId: 'seed.md', testTitle: 'Week ' + (40 + d), mode: 'full', startedAt: when, finishedAt: when, completed: true, total: 10, correct: results.filter((r) => r.correct).length, results }, [])
    }
  })
  await page.keyboard.press('Meta+4')
  await sleep(700)
  await shot('stats')
  await page.locator('.recharts-surface').first().hover({ position: { x: 300, y: 100 } })
  await shot('stats-hover')
  await page.mouse.move(700, 500)
  await page.mouse.wheel(0, 800)
  await shot('stats-scrolled')
  await practiceBankOnce(page)
  await bank('bank after 1 practice')
  await shot('practice-results')
  await practiceBankOnce(page)
  await bank('bank after 2 practices')
  await page.keyboard.press('Meta+4')
  await page.getByRole('button', { name: 'Dark theme' }).click()
  await sleep(500)
  await shot('stats-dark')
  await page.getByRole('button', { name: 'System theme' }).click()
}

scenarios.gemini = async ({ page, shot }) => {
  await ensureSetup(page)
  await page.getByRole('button', { name: /^Settings/ }).click()
  await sleep(400)
  await page.getByRole('button', { name: 'Test', exact: true }).first().click()
  await sleep(3500)
  await shot('gemini-test')
}

scenarios.timing = async ({ page }) => {
  await ensureSetup(page)
  for (const p of ['gemini', 'gemini', 'deepl']) {
    const r = await page.evaluate(async (provider) => {
      const t = Date.now()
      const res = await window.api.translate.test(provider)
      return { provider, ms: Date.now() - t, res }
    }, p)
    console.log(JSON.stringify(r))
  }
}

scenarios.gemmodels = async ({ page }) => {
  await ensureSetup(page)
  const words = ['bridge', 'although', 'look forward to', 'had already started', 'whereas', 'sustainable']
  for (const w of words) {
    const r = await page.evaluate(async (text) => {
      const t = Date.now()
      const res = await window.api.translate.run(text, `Context sentence with ${text}.`)
      return { ms: Date.now() - t, ok: res.ok, provider: res.ok ? res.provider : res.code, tr: res.ok ? res.translation : res.message }
    }, w)
    console.log(`TOTAL ${String(r.ms).padStart(6)} ms  ${w} → ${r.ok} ${r.provider} ${String(r.tr).slice(0, 50)}`)
  }
}

const WORDS = [
  ['look forward to', 'з нетерпінням чекати', 'I really look forward to seeing you next week.', 'Phrasal verbs'],
  ['give up', 'здаватися, кидати', "Don't give up on your dreams.", 'Phrasal verbs'],
  ['get along with', 'ладнати з', 'I get along with my neighbours.', 'Phrasal verbs'],
  ['deadline', 'кінцевий термін', 'We have to meet the deadline by Friday.', 'Work'],
  ['reliable', 'надійний', 'She is a very reliable colleague.', 'Work'],
  ['commute', 'дорога на роботу', 'My daily commute takes an hour.', 'Work'],
  ['appointment', 'запис, зустріч', 'I have a dentist appointment at 3 pm.', 'Work'],
  ['although', 'хоча', 'Although it was raining, we went for a walk.', null],
  ['sustainable', 'сталий, екологічний', 'We need a more sustainable way of living.', null],
  ['whereas', 'тоді як', 'I like tea, whereas my sister prefers coffee.', null],
  ['eventually', 'зрештою', 'Eventually, we found the right hotel.', null],
  ['renovated', 'відремонтований', 'The museum was renovated last year.', null]
]

async function seedVocab(page) {
  await page.evaluate(async (words) => {
    const decks = {}
    for (const name of ['Phrasal verbs', 'Work']) decks[name] = (await window.api.decks.create(name)).id
    let t = Date.now() - 3600_000
    for (const [text, translation, context, deck] of words) {
      await window.api.vocab.add({ id: crypto.randomUUID(), text, translation, context, source: { kind: 'note', title: 'English Tenses — Cheat Sheet' }, createdAt: new Date(t += 1000).toISOString(), deckId: deck ? decks[deck] : undefined })
    }
  }, WORDS)
}

scenarios.vocab = async ({ page, shot }) => {
  await ensureSetup(page)
  await seedVocab(page)
  await page.getByRole('button', { name: /^Vocabulary/ }).click()
  await sleep(600)
  await shot('vocab-library')
  // Word sheet + AI fill (fake provider)
  await page.getByText('look forward to', { exact: true }).first().click()
  await sleep(400)
  await page.getByRole('button', { name: /Fill details with AI/ }).click()
  await sleep(800)
  await shot('vocab-sheet-enriched')
  await press(page, 'Escape')
  // Bulk selection
  const boxes = page.locator('main input[type=checkbox]')
  await boxes.nth(2).check()
  await boxes.nth(3).check()
  await boxes.nth(4).check()
  await sleep(300)
  await shot('vocab-bulk')
  await page.getByRole('button', { name: 'Clear selection' }).click()
  // Auto-group remaining words
  await page.getByRole('button', { name: /Auto-group/ }).click()
  await sleep(4000)
  await shot('vocab-grouped')
  // Deck view
  await page.getByRole('button', { name: /^Work/ }).first().click()
  await sleep(400)
  await shot('vocab-deck-work')
  await page.getByRole('button', { name: /^All words/ }).click()
  await sleep(300)

  // Review: flashcards (all words are new → flashcard first)
  await press(page, 'r')
  await sleep(600)
  await shot('review-flashcard-question')
  await press(page, ' ')
  await sleep(300)
  await shot('review-flashcard-answer')
  await press(page, '3')
  await sleep(400)
  await press(page, ' ', '1') // Again → comes back in this session
  await sleep(300)
  for (let i = 0; i < 4; i++) {
    await press(page, ' ', '3')
    await sleep(250)
  }
  await shot('review-progress')
  await press(page, 'Escape')
  await sleep(400)

  const runMode = async (mode, label, act) => {
    await page.evaluate((m) => window.api.settings.update({ reviewMode: m }), mode)
    await page.reload()
    await sleep(900)
    await page.getByRole('button', { name: /^Vocabulary/ }).click()
    await sleep(500)
    await page.getByRole('button', { name: /^(Practise|Review)/ }).last().click()
    await sleep(700)
    await shot(`review-${label}-question`)
    await act()
    await sleep(400)
    await shot(`review-${label}-answer`)
    await press(page, 'Escape')
    await sleep(300)
  }
  const currentWord = () => page.evaluate(async () => {
    const all = await window.api.vocab.list()
    const t = document.querySelector('main h2')?.textContent ?? ''
    const ctx = document.querySelector('main p.text-\\[20px\\]')?.textContent ?? ''
    return all.find((w) => t.includes(w.text) || t.includes(w.translation) || (ctx && ctx.replace(/\s+/g, ' ').startsWith((w.context ?? '').slice(0, 8))))
  })
  await runMode('cloze', 'cloze', async () => {
    const w = await currentWord()
    await page.keyboard.type(w?.text ?? 'x')
    await press(page, 'Enter')
  })
  await runMode('typing', 'typing-typo', async () => {
    const w = await currentWord()
    const t = w?.text ?? 'xxxxx'
    await page.keyboard.type(t.length > 5 ? t.slice(0, 2) + t[3] + t[2] + t.slice(4) : t) // swap two letters
    await press(page, 'Enter')
  })
  await runMode('choice', 'choice', async () => {
    await press(page, '2')
  })
  await page.evaluate(() => window.api.settings.update({ reviewMode: 'mixed' }))

  // Finish a full session of whatever is left (cram)
  await page.reload()
  await sleep(900)
  await page.getByRole('button', { name: /^Vocabulary/ }).click()
  await sleep(400)
  await page.getByText('reliable', { exact: true }).first().click()
  await sleep(300)
  await page.getByRole('button', { name: /^Practise$/ }).first().click()
  await sleep(600)
  for (let i = 0; i < 6; i++) {
    if (await page.getByText(/Practice complete|Done for now/).count()) break
    const typing = await page.locator('main input:not([type=checkbox])').count()
    if (typing) {
      const w = await currentWord()
      await page.keyboard.type(w?.text ?? 'reliable')
      await press(page, 'Enter', 'Enter')
    } else {
      const choice = await page.getByText('Press 1–4 to choose').count()
      await press(page, ...(choice ? ['1', 'Enter'] : [' ', 'Enter']))
    }
    await sleep(300)
  }
  await shot('review-done')
  await press(page, 'Escape')

  // Stats
  await page.getByRole('button', { name: /^Stats/ }).click()
  await sleep(600)
  await page.mouse.move(700, 500)
  await page.mouse.wheel(0, 1200)
  await sleep(300)
  await shot('stats-vocab')

  // Popover with deck picker
  await page.getByRole('button', { name: /^Notes/ }).click()
  await sleep(400)
  await page.locator('article').getByText('Every English tense').first().dblclick()
  await sleep(700)
  await shot('popover-deck')
  await press(page, 'Escape')

  // Dark review
  await page.getByRole('button', { name: 'Dark theme' }).click()
  await page.getByRole('button', { name: /^Vocabulary/ }).click()
  await sleep(400)
  await page.getByRole('button', { name: /^(Practise|Review)/ }).last().click()
  await sleep(600)
  await press(page, ' ')
  await sleep(300)
  await shot('review-dark')
  await press(page, 'Escape')
  await page.getByRole('button', { name: 'System theme' }).click()
}

scenarios.pkgvocab = async ({ page }) => {
  await ensureSetup(page)
  await seedVocab(page)
  const r = await page.evaluate(async () => {
    const [w] = await window.api.vocab.list()
    const after = await window.api.vocab.review(w.id, 3, 'flashcard', 1200)
    return { text: w.text, before: w.srs.state, after: after?.srs.state, due: after?.srs.due, logs: (await window.api.vocab.reviews()).length, decks: (await window.api.decks.list()).length }
  })
  console.log('PKG', JSON.stringify(r))
}

scenarios.voices = async ({ page, shot }) => {
  await ensureSetup(page)
  await sleep(500)
  const v = await page.evaluate(() => [...document.querySelectorAll('x')].length)
  console.log('VOICES', v)
  await page.getByRole('button', { name: /^Settings/ }).click()
  await sleep(400)
  await page.getByText('Pronounce words').scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 250)
  await sleep(300)
  await shot('voice-row')
  await page.locator('button[role=combobox]').filter({ hasText: 'Automatic' }).click()
  await sleep(400)
  await shot('voice-list')
}

scenarios.voicelist = async ({ page }) => {
  await sleep(1500)
  const v = await page.evaluate(() => speechSynthesis.getVoices().filter((x) => /^en/.test(x.lang)).map((x) => `${x.name} [${x.lang}] local=${x.localService} default=${x.default}`))
  console.log(v.join('\n'))
}

scenarios.autovoice = async ({ page, shot }) => {
  await ensureSetup(page)
  await page.getByRole('button', { name: /^Settings/ }).click()
  await sleep(500)
  await page.getByText('Pronounce words').scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 250)
  await page.locator('button[role=combobox]').filter({ hasText: 'Automatic' }).click()
  await sleep(400)
  await shot('auto-voice')
}

scenarios.vocabfiles = async ({ page, shot, contentDir }) => {
  await ensureSetup(page)
  const words = async () => page.evaluate(async () => (await window.api.vocab.list()).map((w) => ({ text: w.text, tr: w.translation, ctx: w.context, ex: w.examples, deck: w.deckId, src: w.source.kind })))
  // 1. Words saved earlier from the popover
  await page.evaluate(async () => {
    for (const [text, translation, context] of [['deadline', 'дедлайн', 'The deadline is tomorrow.'], ['give up', 'здаватися', "Don't give up."], ['aspect', 'аспект', 'an aspect']]) {
      await window.api.vocab.add({ id: crypto.randomUUID(), text, translation, context, source: { kind: 'note', title: 'Note' }, createdAt: new Date().toISOString() })
    }
  })
  // 2. A Markdown file with duplicates in other spellings + new words + one without translation
  const file = join(contentDir, 'vocabulary', 'work.md')
  writeFileSync(file, `---\ndeck: Work\ntags: [b2]\n---\n\n- The Deadline — кінцевий термін\n  > We have to meet the deadline by Friday.\n- commute — дорога на роботу\n  > My daily commute takes an hour.\n- to give up — кидати\n- reliable\n- eventually — зрештою\n- commute — duplicate inside the file\n`)
  await sleep(2500)
  await page.getByRole('button', { name: /^Vocabulary/ }).click()
  await sleep(600)
  await shot('files-imported')
  let w = await words()
  console.log('AFTER IMPORT', w.length, JSON.stringify(w.map((x) => `${x.text}=${x.tr}`)))
  console.log('deadline kept context + example:', JSON.stringify(w.find((x) => x.text === 'deadline')))
  // 3. Edit a line in the file → translation updated; remove a line → word stays
  writeFileSync(file, `---\ndeck: Work\ntags: [b2]\n---\n\n- The Deadline — кінцевий термін\n  > We have to meet the deadline by Friday.\n- commute — щоденна дорога на роботу\n  > My daily commute takes an hour.\n- to give up — кидати\n- reliable\n`)
  await sleep(2500)
  w = await words()
  console.log('AFTER EDIT', w.length, 'commute=', w.find((x) => x.text === 'commute')?.tr, 'eventually still there:', Boolean(w.find((x) => x.text === 'eventually')))
  await shot('files-after-edit')
  // 4. Manual add of a duplicate
  await page.keyboard.press('Meta+n')
  await sleep(300)
  await page.keyboard.type('Give Up')
  await sleep(300)
  await shot('add-duplicate-hint')
  await press(page, 'Escape')
  // 5. Popover on a word that's already saved
  await page.getByRole('button', { name: /^Notes/ }).click()
  await sleep(400)
  await page.locator('article').getByText('aspect', { exact: true }).first().dblclick()
  await sleep(800)
  await shot('popover-known-word')
  await page.getByRole('button', { name: 'Update', exact: true }).click()
  await sleep(500)
  console.log('aspect after Update:', JSON.stringify(await page.evaluate(async () => (await window.api.vocab.list()).filter((w) => w.text === 'aspect').map((w) => [w.translation, w.context, w.examples]))))
  const fs = await import('node:fs')
  console.log('.workbook files:', fs.readdirSync(join(contentDir, '.workbook')).join(', '))
}

scenarios.migration = async ({ page, contentDir }) => {
  await sleep(1500)
  const r = await page.evaluate(async () => ({
    words: (await window.api.vocab.list()).map((w) => `${w.text}=${w.translation} tags:${w.tags.join('|')} srs:${w.srs.state}`),
    attempts: (await window.api.progress.attempts()).length,
    dataDir: await window.api.app.dataDir()
  }))
  console.log('MIGRATED', JSON.stringify(r, null, 1))
  const fs = await import('node:fs')
  console.log('.workbook:', fs.readdirSync(join(contentDir, '.workbook')).join(', '))
  console.log('vocabulary/ exists:', fs.existsSync(join(contentDir, 'vocabulary')), ' VOCAB_FORMAT.md:', fs.existsSync(join(contentDir, 'VOCAB_FORMAT.md')))
}

scenarios.tour = async ({ page, shot }) => {
  await ensureSetup(page)
  await sleep(1500) // the tour opens by itself after setup
  for (let i = 0; i < 12; i++) {
    await shot(`tour-${i + 1}`)
    await press(page, 'ArrowRight')
    await sleep(700)
  }
  const done = await page.evaluate(async () => (await window.api.settings.get()).tourDone)
  console.log('tourDone after finishing:', done)
}

scenarios.today = async ({ page, shot }) => {
  await ensureSetup(page)
  await page.evaluate(() => window.api.settings.update({ tourDone: true }))
  await page.reload()
  await sleep(800)
  await shot('today-empty')
  await seedVocab(page)
  // History: tests with weak Past Perfect, reviews on several days
  await page.evaluate(async () => {
    const tests = await window.api.content.tests()
    const items = tests[0].items
    const day = (n) => new Date(Date.now() - n * 86400000).toISOString()
    for (const n of [9, 6, 3, 2, 1]) {
      const results = items.map((i, k) => ({ key: i.key, questionId: i.id, type: i.type, topics: i.topics, correct: i.topics.includes('Past Perfect') ? k % 3 === 0 : k % 4 !== 0, userAnswer: 'x', correctAnswer: 'y' }))
      await window.api.progress.saveAttempt({ id: 'h' + n, testId: 'other.md', testTitle: 'Older test', mode: 'retry', startedAt: day(n), finishedAt: day(n), completed: true, total: results.length, correct: results.filter((r) => r.correct).length, results }, items)
    }
    const words = await window.api.vocab.list()
    for (const w of words.slice(0, 6)) await window.api.vocab.review(w.id, 3, 'flashcard', 1000)
  })
  await page.getByRole('button', { name: /^Notes/ }).click()
  await sleep(300)
  await page.getByRole('button', { name: /^Today/ }).click()
  await sleep(800)
  await shot('today-plan')
  // Start the weak-topic practice from the plan
  const btns = page.getByRole('button', { name: 'Practise' })
  console.log('practise buttons:', await btns.count())
  await btns.last().click()
  await sleep(600)
  await shot('today-topic-session')
  await press(page, 'Escape')
  await sleep(300)
  await page.getByRole('button', { name: 'Dark theme' }).click()
  await page.getByRole('button', { name: /^Today/ }).click()
  await sleep(600)
  await shot('today-dark')
  await page.getByRole('button', { name: 'System theme' }).click()
  await page.getByRole('button', { name: 'Help' }).click()
  await sleep(400)
  await shot('help-dialog')
}

scenarios.notesdoc = async ({ page, shot, contentDir }) => {
  await ensureSetup(page)
  await sleep(1600)
  await page.keyboard.press('Escape') // close the first-run tour like a user would
  const fs = await import('node:fs')
  console.log('NOTES_FORMAT.md in workbook:', fs.existsSync(join(contentDir, 'NOTES_FORMAT.md')))
  const doc = fs.readFileSync(join(contentDir, 'NOTES_FORMAT.md'), 'utf8')
  const example = [...doc.matchAll(/```markdown\n([\s\S]*?)\n```/g)].map((m) => m[1]).at(-1)
  fs.mkdirSync(join(contentDir, 'notes', 'grammar'), { recursive: true })
  fs.writeFileSync(join(contentDir, 'notes', 'grammar', 'articles.md'), example)
  await sleep(1200)
  await page.getByRole('button', { name: /^Notes/ }).click()
  await sleep(400)
  await page.getByText('Articles — a, an, the').first().click()
  await sleep(500)
  await shot('example-note')
  await page.mouse.move(800, 500)
  await page.mouse.wheel(0, 700)
  await shot('example-note-scrolled')
  await page.getByRole('button', { name: 'Help' }).click()
  await sleep(400)
  await shot('help')
}

scenarios.shuffle = async ({ page, shot }) => {
  await ensureSetup(page)
  await sleep(1600)
  await page.keyboard.press('Escape') // first-run tour
  const order = async () => {
    const seen = []
    for (let i = 0; i < 8; i++) {
      const id = (await page.locator('main span.ml-auto').first().textContent())?.trim()
      const opts = await page.locator('main button').filter({ hasText: /^\d/ }).allTextContents()
      seen.push(`${id}${opts.length ? ' [' + opts.map((o) => o.replace(/^\d/, '')).join(' / ') + ']' : ''}`)
      await page.getByRole('button', { name: /I don't know/ }).click()
      await sleep(150)
      await press(page, 'Enter')
      await sleep(250)
    }
    return seen
  }
  for (const run of [1, 2]) {
    await page.getByRole('button', { name: /^Tests/ }).first().click()
    await sleep(400)
    await page.getByText('Tenses — All Question Types').first().click()
    await sleep(500)
    await press(page, 'Enter')
    await sleep(500)
    if (run === 1) await shot('question-before-answer')
    console.log(`RUN ${run}:`, JSON.stringify(await order(), null, 0))
    if (run === 1) {
      await page.getByRole('button', { name: /I don't know/ }).click()
      await sleep(300)
      await shot('question-after-answer')
    }
    await press(page, 'Escape')
    await sleep(400)
  }
}

scenarios.persistA = async ({ page }) => {
  await ensureSetup(page)
  await seedVocab(page)
  await page.evaluate(async () => {
    const w = (await window.api.vocab.list())[0]
    await window.api.vocab.review(w.id, 3, 'flashcard', 900)
    const t = (await window.api.content.tests())[0]
    const items = t.items.slice(0, 3)
    const results = items.map((i, k) => ({ key: i.key, questionId: i.id, type: i.type, topics: i.topics, correct: k > 0, userAnswer: 'x', correctAnswer: 'y' }))
    await window.api.progress.saveAttempt({ id: 'p1', testId: t.id, testTitle: t.title, mode: 'full', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), completed: true, total: 3, correct: 2, results }, items)
    await window.api.settings.update({ provider: 'deepl', theme: 'dark', tourDone: true })
    await window.api.secrets.set('gemini', 'AIzaFAKE-KEY-FOR-PERSISTENCE-TEST')
  })
  console.log('A: seeded')
}

scenarios.persistB = async ({ page }) => {
  await sleep(1200)
  const setupShown = (await page.getByRole('button', { name: /Use this folder/ }).count()) > 0
  await ensureSetup(page)
  await sleep(1200)
  const r = await page.evaluate(async () => {
    const words = await window.api.vocab.list()
    return {
      words: words.length,
      reviewedWord: words.filter((w) => w.srs.state !== 0).length,
      decks: (await window.api.decks.list()).length,
      attempts: (await window.api.progress.attempts()).length,
      mistakes: (await window.api.progress.mistakes()).length,
      reviewsLog: (await window.api.vocab.reviews()).length,
      settings: await window.api.settings.get().then((s) => ({ provider: s.provider, theme: s.theme, tourDone: s.tourDone })),
      keySaved: (await window.api.secrets.status()).gemini
    }
  })
  console.log('B: setupScreenShown=', setupShown, JSON.stringify(r))
}
