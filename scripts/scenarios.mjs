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

  async irregular({ page, shot }) {
    await ensureSetup(page)
    await page.evaluate(() => window.api.settings.update({ tourDone: true }))
    await page.reload()
    await page.waitForTimeout(800)
    // 1. find inside a note (⌘F), list search stays on ⌘K
    await page.getByRole('button', { name: /^Notes/ }).click()
    await page.waitForTimeout(500)
    await page.keyboard.press('Meta+f')
    await page.waitForTimeout(200)
    await page.keyboard.type('the')
    await page.waitForTimeout(400)
    await shot('find-bar')
    console.log('find counter:', await page.getByText(/^\d+ \/ \d+$/).first().textContent())
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await shot('find-next')
    await page.keyboard.press('Escape')
    // 2. irregular verbs
    await page.getByRole('button', { name: /^Irregular verbs/ }).click()
    await page.waitForTimeout(500)
    await shot('irregular-home')
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await page.waitForTimeout(300)
    await page.keyboard.type('was')
    await page.keyboard.press('Enter')
    await page.keyboard.type('been')
    await page.keyboard.press('Enter')
    await shot('drill-correct')
    await page.keyboard.press('Enter')
    await page.keyboard.type('hed')
    await page.keyboard.press('Enter')
    await page.keyboard.type('had')
    await page.keyboard.press('Enter')
    await shot('drill-wrong')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'reference' }).click()
    await page.getByRole('button', { name: /Cover/ }).click()
    await shot('reference-covered')
    // 3. a test survives a look into the notes
    await page.getByRole('button', { name: /^Tests/ }).click()
    await page.waitForTimeout(400)
    await page.getByText('Tenses — All Question Types').first().click()
    await page.waitForTimeout(500)
    await shot('test-detail')
    await page.getByRole('button', { name: /Start|Begin|Full test/ }).first().click()
    await page.waitForTimeout(600)
    await shot('test-running')
    await page.getByRole('button', { name: /^Notes/ }).click()
    await page.waitForTimeout(400)
    await shot('notes-while-test')
    console.log('resume pill:', await page.getByText('Test in progress').count())
    await page.getByRole('button', { name: /Test in progress/ }).click()
    await page.waitForTimeout(400)
    await shot('test-resumed')
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

scenarios.retrytoday = async ({ page, shot }) => {
  await ensureSetup(page)
  await sleep(1600)
  await page.keyboard.press('Escape') // first-run tour
  // 1. take the sample test, answering every question wrongly with "I don't know"
  await page.getByRole('button', { name: /^Tests/ }).first().click()
  await sleep(400)
  await page.getByText('Tenses — All Question Types').first().click()
  await sleep(500)
  await press(page, 'Enter')
  await sleep(500)
  for (let i = 0; i < 21; i++) {
    await page.getByRole('button', { name: /I don't know/ }).click()
    await sleep(120)
    await press(page, 'Enter')
    await sleep(160)
  }
  await sleep(800)
  await shot('results')
  // 2. retry the mistakes right away (answer them correctly through the bank view: use the real answers)
  await press(page, 'r')
  await sleep(600)
  const answers = await page.evaluate(async () => Object.fromEntries((await window.api.content.tests())[0].items.map((i) => [i.id, i])))
  for (let i = 0; i < 70; i++) {
    if (await page.getByText(/Test complete|Good job|Excellent|Perfect|Getting there|Keep practising/).count()) break
    const id = (await page.locator('main span.ml-auto').first().textContent())?.trim()
    const q = answers[id]
    if (!q) break
    if (q.type === 'choice') await press(page, String(q.options.indexOf(q.answer) + 1))
    else if (q.type === 'tf') await press(page, q.answer === 'true' ? 't' : q.answer === 'false' ? 'f' : 'n')
    else if (q.type === 'order') for (const c of q.chunks) await page.locator('button').filter({ hasText: new RegExp('^\\d?\\s*' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click()
    else if (q.type === 'match') for (const p of q.pairs) await page.locator('button').filter({ hasText: new RegExp('^\\d+\\s*' + p.right.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[A-Z]?$') }).first().click()
    else await page.keyboard.type(q.answers[0])
    await press(page, 'Enter', 'Enter')
    await sleep(200)
  }
  await sleep(800)
  await shot('retry-results')
  // 3. leave the session (answers so far are saved), then open Today
  await press(page, 'Escape')
  await sleep(600)
  console.log('bank after retry (id:streak):', JSON.stringify((await page.evaluate(() => window.api.progress.mistakes())).map((m) => `${m.item.id}:${m.streak}`)))
  await page.getByRole('button', { name: /^Today/ }).click()
  await sleep(800)
  await shot('today-after-retry')
}

scenarios.wordtest = async ({ page, shot }) => {
  await ensureSetup(page)
  await sleep(1600)
  await page.keyboard.press('Escape') // first-run tour
  await seedVocab(page)
  // Give the sentences/examples a realistic shape
  await page.evaluate(async () => {
    const all = await window.api.vocab.list()
    for (const w of all.slice(0, 4)) await window.api.vocab.update(w.id, { pos: 'noun', examples: ['This is a longer example sentence for ' + w.text + '.'] })
  })
  await page.getByRole('button', { name: /^Vocabulary/ }).click()
  await sleep(600)
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await sleep(500)
  await shot('word-test-dialog')
  await page.getByRole('button', { name: 'Start test' }).click()
  await sleep(700)
  await shot('word-test-first-question')
  // Answer every question correctly using the same data the app generated from
  const answered = []
  for (let i = 0; i < 40; i++) {
    if (await page.getByText(/Word test complete/).count()) break
    const kind = (await page.locator('main span.rounded-md').first().textContent())?.trim()
    answered.push(kind)
    // Multiple choice: pick option 1; everything else: "I don't know" (keeps the harness generic)
    if (kind === 'Multiple choice') await press(page, '1', 'Enter')
    else await page.getByRole('button', { name: /I don't know/ }).click()
    await sleep(200)
    await press(page, 'Enter')
    await sleep(250)
  }
  await sleep(800)
  await shot('word-test-results')
  console.log('kinds seen while answering:', JSON.stringify([...new Set(answered)]))
  const attempts = await page.evaluate(() => window.api.progress.attempts())
  console.log('attempt:', JSON.stringify(attempts.map((a) => [a.mode, a.testTitle, a.completed, `${a.correct}/${a.total}`])))
  console.log('question types asked:', JSON.stringify([...new Set(attempts[0].results.map((r) => r.type))]))
  console.log('topics:', JSON.stringify([...new Set(attempts[0].results.flatMap((r) => r.topics))]))
  const srs = await page.evaluate(async () => (await window.api.vocab.list()).filter((w) => w.srs.state !== 0).length)
  console.log('words whose SRS state changed by the test (must be 0):', srs)
  console.log('bank:', (await page.evaluate(() => window.api.progress.mistakes())).length)

  // Copy the AI prompt
  await page.getByRole('button', { name: /Done|Back to tests/ }).first().click().catch(() => {})
  await sleep(400)
  await page.getByRole('button', { name: /^Vocabulary/ }).click()
  await sleep(400)
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await sleep(400)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  await page.getByRole('button', { name: /AI prompt/ }).click()
  await sleep(500)
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => 'CLIPBOARD ERROR ' + e.message)
  console.log('prompt starts:', JSON.stringify(clip.slice(0, 120)))
  console.log('prompt has words:', /1\. .+ — .+/.test(clip), '| has spec:', clip.includes('===== TEST FORMAT SPEC ====='), '| length:', clip.length)
  await shot('after-copy')
}

scenarios.wordtestpages = async ({ page, shot }) => {
  await ensureSetup(page)
  await sleep(1600)
  await page.keyboard.press('Escape')
  await seedVocab(page)
  await page.getByRole('button', { name: /^Notes/ }).click()
  await sleep(300)
  await page.getByRole('button', { name: /^Today/ }).click()
  await sleep(900)
  await shot('today-with-word-test')
  await page.getByRole('button', { name: /^Tests/ }).first().click()
  await sleep(600)
  await shot('tests-page-button')
  await page.getByRole('button', { name: /^Vocabulary/ }).click()
  await sleep(500)
  await page.getByText('Work', { exact: true }).first().click()
  await sleep(400)
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await sleep(500)
  await shot('dialog-from-deck-view')
}

scenarios.readinggaps = async ({ page, shot }) => {
  await ensureSetup(page)
  await sleep(1600)
  await page.keyboard.press('Escape') // first-run tour
  await seedVocab(page)
  const openDialog = async () => {
    await page.getByRole('button', { name: /^Notes/ }).click()
    await sleep(250)
    await page.getByRole('button', { name: /^Vocabulary/ }).click()
    await sleep(500)
    await page.getByRole('button', { name: 'Test', exact: true }).click()
    await sleep(500)
  }
  // 1. Nothing practised yet → the dialog must not offer new words by default
  await openDialog()
  await shot('dialog-nothing-practised')
  const startDisabled = await page.getByRole('button', { name: 'Start test' }).isDisabled()
  console.log('1. nothing practised: Start disabled =', startDisabled)
  await press(page, 'Escape')
  // 2. Practise 6 words, then the quiz may only contain those
  const practisedIds = await page.evaluate(async () => {
    const words = await window.api.vocab.list()
    const ids = []
    for (const w of words.slice(0, 6)) { await window.api.vocab.review(w.id, 3, 'flashcard', 900); ids.push(w.id) }
    return ids
  })
  await openDialog()
  await shot('dialog-after-practice')
  await page.getByRole('button', { name: 'Start test' }).click()
  await sleep(700)
  for (let i = 0; i < 20; i++) {
    if (await page.getByText(/Word test complete/).count()) break
    const kind = (await page.locator('main span.rounded-md').first().textContent())?.trim()
    if (kind === 'Multiple choice') await press(page, '1', 'Enter')
    else await page.getByRole('button', { name: /I don't know/ }).click()
    await sleep(150)
    await press(page, 'Enter')
    await sleep(200)
  }
  await sleep(600)
  const quiz = await page.evaluate(async () => (await window.api.progress.attempts()).at(-1))
  const askedIds = quiz.results.filter((r) => !r.key.startsWith('words#match')).map((r) => r.key.replace('words#', '').replace(/:.*/, ''))
  console.log('2. quiz asked about', askedIds.length, 'words; all of them practised =', askedIds.every((id) => practisedIds.includes(id)))
  await press(page, 'Escape')
  await sleep(300)
  // 3. Reading with gaps (fake AI text)
  await openDialog()
  await page.getByRole('button', { name: 'Reading with gaps' }).click()
  await sleep(300)
  await shot('dialog-reading-format')
  await page.getByRole('button', { name: 'Start test' }).click()
  await sleep(1200)
  await shot('reading-first-gap')
  const info = await page.evaluate(() => ({ title: document.querySelector('main header span.truncate')?.textContent, passage: document.querySelector('main h2')?.textContent, options: [...document.querySelectorAll('main button')].filter((b) => /^\d/.test(b.textContent ?? '')).map((b) => b.textContent?.replace(/^\d/, '')) }))
  console.log('3. reading session:', JSON.stringify(info))
  await press(page, '1', 'Enter')
  await sleep(300)
  await shot('reading-after-answer')
  await press(page, 'Escape')
}

scenarios.readingoffline = async ({ page, shot }) => {
  await ensureSetup(page)
  await sleep(1600)
  await page.keyboard.press('Escape')
  await seedVocab(page)
  await page.evaluate(async () => { for (const w of (await window.api.vocab.list()).slice(0, 8)) await window.api.vocab.review(w.id, 3, 'flashcard', 900) })
  await page.getByRole('button', { name: /^Vocabulary/ }).click()
  await sleep(500)
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await sleep(400)
  await page.getByRole('button', { name: 'Reading with gaps' }).click()
  await page.getByRole('button', { name: 'Start test' }).click()
  await sleep(2500)
  await shot('offline-reading')
  const info = await page.evaluate(() => document.querySelector('main')?.innerText.slice(0, 700))
  console.log('offline reading screen:\n' + info)
}

scenarios.typo = async ({ page, shot }) => {
  await ensureSetup(page)
  await sleep(1600)
  await page.keyboard.press('Escape') // first-run tour
  await page.evaluate(async () => {
    const mk = async (text, translation, context) => {
      const e = await window.api.vocab.add({ id: crypto.randomUUID(), text, translation, context, source: { kind: 'other', title: 'x' }, createdAt: new Date().toISOString() })
      await window.api.vocab.review(e.id, 3, 'flashcard', 900)
    }
    await mk('documentation', 'документація', 'Read the documentation first.')
    await mk('deadline', 'кінцевий термін', 'We have to meet the deadline by Friday.')
    await mk('reliable', 'надійний', 'She is a very reliable colleague.')
    await mk('commute', 'дорога на роботу', 'My daily commute takes an hour.')
    await mk('appointment', 'запис, зустріч', 'I have a dentist appointment at 3 pm.')
  })
  await page.getByRole('button', { name: /^Vocabulary/ }).click()
  await sleep(500)
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await sleep(400)
  for (const k of ['Choose the translation', 'Choose the English word', 'Fill the gap', 'Build the sentence', 'Match pairs']) await page.getByRole('button', { name: new RegExp('^' + k) }).click()
  await page.getByRole('button', { name: 'Start test' }).click()
  await sleep(700)
  const answers = { 'документація': 'documentaition', 'кінцевий термін': 'dedline', 'надійний': 'relable', 'дорога на роботу': 'comute', 'запис, зустріч': 'apointment' }
  for (let i = 0; i < 5; i++) {
    const prompt = await page.locator('main p').first().textContent()
    const key = Object.keys(answers).find((k) => prompt?.includes(k))
    await page.keyboard.type(answers[key])
    await press(page, 'Enter')
    await sleep(350)
    if (i === 0) await shot('typo-feedback')
    await press(page, 'Enter')
    await sleep(250)
  }
  await sleep(700)
  const a = await page.evaluate(async () => (await window.api.progress.attempts()).at(-1))
  console.log('typed with one slip each → score', a.correct + '/' + a.total)
  // Same slips with the setting off must be wrong
  await page.evaluate(() => window.api.settings.update({ forgiveTypos: false }))
}

scenarios.forms = async ({ page, shot }) => {
  await ensureSetup(page)
  await sleep(1600)
  await page.keyboard.press('Escape') // first-run tour
  await page.evaluate(async () => {
    const mk = async (text, translation, context, examples) => {
      const e = await window.api.vocab.add({ id: crypto.randomUUID(), text, translation, context, examples, source: { kind: 'other', title: 'x' }, createdAt: new Date().toISOString() })
      await window.api.vocab.review(e.id, 3, 'flashcard', 900)
    }
    await mk('to give up', 'здаватися', "Don't give up on your dreams.", ['She is giving up her job.', 'He gave up smoking last year.'])
    await mk('deadline', 'кінцевий термін', 'We have to meet the deadline by Friday.')
    await mk('reliable', 'надійний', 'She is a very reliable colleague.')
    await mk('commute', 'дорога на роботу', 'My daily commute takes an hour.')
    await mk('appointment', 'запис, зустріч', 'I have a dentist appointment at 3 pm.')
  })
  const openDialog = async () => {
    await page.getByRole('button', { name: /^Notes/ }).click()
    await sleep(250)
    await page.getByRole('button', { name: /^Vocabulary/ }).click()
    await sleep(500)
    await page.getByRole('button', { name: 'Test', exact: true }).click()
    await sleep(400)
  }
  const onlyForm = async () => {
    for (const k of ['Choose the translation', 'Choose the English word', 'Write it in English', 'Fill the gap', 'Build the sentence', 'Match pairs']) await page.getByRole('button', { name: new RegExp('^' + k) }).click()
  }
  // 1. wrong form (the base word)
  await openDialog()
  await shot('dialog-with-form-kind')
  await onlyForm()
  await page.getByRole('button', { name: 'Start test' }).click()
  await sleep(700)
  const prompt1 = await page.locator('main .selectable').first().textContent()
  console.log('prompt 1:', prompt1)
  await page.keyboard.type('give up')
  await press(page, 'Enter')
  await sleep(400)
  await shot('base-form-is-wrong')
  const a1 = await page.evaluate(async () => (await window.api.progress.attempts()).length)
  await press(page, 'Enter')
  await sleep(700)
  const r1 = await page.evaluate(async () => (await window.api.progress.attempts()).at(-1))
  console.log('typing the base form "give up" →', r1.correct + '/' + r1.total, '(expected 0/1)')
  await press(page, 'Escape')
  // 2. correct form
  await openDialog()
  await onlyForm()
  await page.getByRole('button', { name: 'Start test' }).click()
  await sleep(700)
  const prompt2 = (await page.locator('main .selectable').first().textContent()) ?? ''
  const right = prompt2.includes('smoking') ? 'gave up' : 'giving up'
  console.log('prompt 2:', prompt2, '→ typing', right)
  await page.keyboard.type(right)
  await press(page, 'Enter')
  await sleep(400)
  await shot('right-form')
  await press(page, 'Enter')
  await sleep(700)
  const r2 = await page.evaluate(async () => (await window.api.progress.attempts()).at(-1))
  console.log('typing the right form →', r2.correct + '/' + r2.total, '(expected 1/1)')
  await press(page, 'Escape')
  // 3. reading with typed forms (fake AI text)
  await openDialog()
  await page.getByRole('button', { name: 'Reading with gaps' }).click()
  await sleep(300)
  await page.getByRole('button', { name: /^Typing the right form/ }).click()
  await shot('dialog-reading-typed')
  await page.getByRole('button', { name: 'Start test' }).click()
  await sleep(1200)
  await shot('reading-typed-question')
}

scenarios.typedvalue = async ({ page }) => {
  await ensureSetup(page)
  await sleep(1600)
  await page.keyboard.press('Escape')
  await page.evaluate(async () => {
    const mk = async (text, translation, context, examples) => {
      const e = await window.api.vocab.add({ id: crypto.randomUUID(), text, translation, context, examples, source: { kind: 'other', title: 'x' }, createdAt: new Date().toISOString() })
      await window.api.vocab.review(e.id, 3, 'flashcard', 900)
    }
    await mk('to give up', 'здаватися', "Don't give up on your dreams.", ['She is giving up her job.', 'He gave up smoking last year.'])
    await mk('deadline', 'кінцевий термін', 'We have to meet the deadline by Friday.')
    await mk('reliable', 'надійний', 'She is a very reliable colleague.')
    await mk('commute', 'дорога на роботу', 'My daily commute takes an hour.')
    await mk('appointment', 'запис, зустріч', 'I have a dentist appointment at 3 pm.')
  })
  await page.getByRole('button', { name: /^Vocabulary/ }).click()
  await sleep(500)
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await sleep(400)
  for (const k of ['Choose the translation', 'Choose the English word', 'Write it in English', 'Fill the gap', 'Build the sentence', 'Match pairs']) await page.getByRole('button', { name: new RegExp('^' + k) }).click()
  await page.getByRole('button', { name: 'Start test' }).click()
  await sleep(900)
  const before = await page.locator('main input').inputValue()
  await page.keyboard.type('give up')
  await sleep(200)
  const after = await page.locator('main input').inputValue()
  console.log(`input before typing: "${before}"  after typing "give up": "${after}"`)
}

scenarios.wordlink = async ({ page, shot, contentDir }) => {
  await ensureSetup(page)
  await sleep(1600)
  await page.keyboard.press('Escape') // first-run tour
  await page.evaluate(() => window.api.settings.update({ shuffleQuestions: false, shuffleAnswers: false }))
  await page.reload() // the window reads settings once at start
  await sleep(1200)
  await page.evaluate(async () => {
    for (const [text, translation] of [['deadline', 'кінцевий термін'], ['reliable', 'надійний'], ['commute', 'дорога на роботу'], ['appointment', 'запис']]) {
      await window.api.vocab.add({ id: crypto.randomUUID(), text, translation, source: { kind: 'other', title: 'x' }, createdAt: new Date().toISOString() })
    }
  })
  writeFileSync(
    join(contentDir, 'tests', 'chat-vocab.md'),
    `---\ntitle: Chat vocabulary test\ntopics: [Vocabulary]\n---\n\n## Q1\ntype: gap\ntopic: Vocabulary\nword: deadline\nq: We have to meet the ___ by Friday.\nanswer: deadline\nexplain: A deadline is the last moment (кінцевий термін).\n\n## Q2\ntype: choice\ntopic: Vocabulary\nword: reliable\nq: She is a very ___ colleague.\noptions: [reliable, rainy, rapid, rare]\nanswer: reliable\nexplain: Reliable means you can trust it.\n\n## Q3\ntype: gap\ntopic: Vocabulary\nword: commute\nq: My daily ___ takes an hour.\nanswer: commute\nexplain: The journey to work.\n\n## Q4\ntype: gap\ntopic: Vocabulary\nword: banana\nq: A yellow fruit: ___\nanswer: banana\nexplain: Not in the vocabulary.\n`
  )
  await sleep(1200)
  const run = async (answers) => {
    await page.getByRole('button', { name: /^Tests/ }).first().click()
    await sleep(400)
    await page.getByText('Chat vocabulary test').first().click()
    await sleep(500)
    await press(page, 'Enter')
    await sleep(600)
    for (const a of answers) {
      if (a === 'pick1') await press(page, '1', 'Enter')
      else if (a) { await page.keyboard.type(a); await press(page, 'Enter') }
      else { await page.getByRole('button', { name: /I don't know/ }).click() }
      await sleep(250)
      await press(page, 'Enter')
      await sleep(300)
    }
    await sleep(600)
  }
  const troubled = () => page.evaluate(async () => (await window.api.vocab.list()).filter((w) => w.trouble).map((w) => `${w.text}(misses ${w.trouble.misses}, streak ${w.trouble.streak})`))
  // 1. Q1 wrong, Q2 right, Q3 wrong, Q4 wrong (the word is not saved)
  await run(['', 'pick1', '', ''])
  await shot('results-words-behind')
  console.log('1. after mistakes, marked difficult:', JSON.stringify(await troubled()))
  await page.getByRole('button', { name: 'Review these words' }).click()
  await sleep(600)
  await shot('review-these-words')
  await press(page, 'Escape')
  await sleep(300)
  // 2. Vocabulary → Difficult
  await page.getByRole('button', { name: /^Vocabulary/ }).click()
  await sleep(500)
  await page.getByRole('button', { name: /^Difficult/ }).click()
  await sleep(400)
  await shot('difficult-list')
  await page.getByText('commute', { exact: true }).first().click()
  await sleep(500)
  await shot('word-sheet-marked')
  await press(page, 'Escape')
  // 3. Answer both correctly twice → the marks clear
  await run(['deadline', 'pick1', 'commute', 'banana'])
  console.log('2. after 1 correct round:', JSON.stringify(await troubled()))
  await run(['deadline', 'pick1', 'commute', 'banana'])
  console.log('3. after 2 correct rounds:', JSON.stringify(await troubled()))
}

scenarios.writing = async ({ page, shot, contentDir }) => {
  await ensureSetup(page)
  await sleep(1600)
  await page.keyboard.press('Escape') // first-run tour
  await page.evaluate(async () => {
    for (const [text, translation] of [['deadline', 'кінцевий термін'], ['reliable', 'надійний'], ['commute', 'дорога на роботу'], ['appointment', 'запис'], ['give up', 'здаватися']]) {
      const e = await window.api.vocab.add({ id: crypto.randomUUID(), text, translation, source: { kind: 'other', title: 'x' }, createdAt: new Date().toISOString() })
      await window.api.vocab.review(e.id, 3, 'flashcard', 900)
    }
  })
  await page.getByRole('button', { name: /^Writing/ }).click()
  await sleep(600)
  await shot('hub-empty')

  // 1. Essay
  await page.getByRole('button', { name: 'Start writing' }).click()
  await sleep(500)
  await shot('essay-dialog')
  await page.getByRole('button', { name: 'Start writing' }).last().click()
  await sleep(800)
  const essay = 'I am agree that working from home is better. Last year I gave up the long commute and I became more productive. My manager is very reliable and we always meet every deadline together. In the evening I have more time for my family, and I do not spend money on transport. However, sometimes I feel lonely, so I visit the office once a week to see my colleagues and to have lunch with them. In my opinion, a mixed schedule is the best solution for most people because it gives both freedom and contact with the team.'
  await page.locator('textarea').fill(essay)
  await sleep(1000)
  await shot('essay-editor')
  await page.getByRole('button', { name: 'Get feedback' }).click()
  await sleep(1500)
  await shot('essay-feedback')
  await page.mouse.move(700, 500)
  await page.mouse.wheel(0, 900)
  await sleep(300)
  await shot('essay-feedback-scrolled')
  const fs = await import('node:fs')
  const files = fs.existsSync(join(contentDir, 'writing')) ? fs.readdirSync(join(contentDir, 'writing')) : []
  console.log('markdown copy in writing/:', JSON.stringify(files))
  if (files[0]) console.log(fs.readFileSync(join(contentDir, 'writing', files[0]), 'utf8').split('\n').slice(0, 9).join(' | '))

  // 2. Conversation
  await page.getByRole('button', { name: 'Back to Writing' }).click()
  await sleep(500)
  await page.getByText('Reschedule a meeting with a colleague').first().click()
  await sleep(500)
  await shot('chat-dialog')
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await sleep(700)
  const say = async (t) => {
    await page.locator('textarea').fill(t)
    await page.keyboard.press('Enter')
    await sleep(1000)
  }
  await say('I am agree, but I cannot come tomorrow because I have a doctor appointment.')
  await shot('chat-tip')
  await say('Could we meet on Thursday at 11 instead?')
  await say('Thank you. What will I miss?')
  await sleep(300)
  await shot('chat-done')
  await page.getByRole('button', { name: /Finish & get feedback/ }).click()
  await sleep(1500)
  await shot('chat-feedback')
  const entries = await page.evaluate(() => window.api.writing.list())
  console.log('entries:', JSON.stringify(entries.map((e) => [e.kind, e.status, e.evaluation?.overall, e.messages.length])))

  // 3. Today plan + hub with history
  await page.getByRole('button', { name: /^Today/ }).click()
  await sleep(900)
  await shot('today-writing-done')
  await page.getByRole('button', { name: /^Writing/ }).click()
  await sleep(700)
  await shot('hub-with-history')
}

scenarios.writinglive = async ({ page }) => {
  await ensureSetup(page)
  await sleep(1200)
  const key = process.env.EW_TEST_GEMINI_KEY
  if (!key) throw new Error('EW_TEST_GEMINI_KEY is not set')
  await page.evaluate((k) => window.api.secrets.set('gemini', k), key)
  const essay = 'I am agree that working from home is better. Last year I give up the long commute and I became more productive. My manager are very reliable and we always meet every deadline. In the evening I have more time for my family and I do not spend money for transport. However, sometimes I feel lonely, so I visit the office one time in week to see my colleagues. In my opinion, a mixed schedule is the best solution because it gives both freedom and contact with the team.'
  const r = await page.evaluate(async (text) => {
    const e = await window.api.writing.create({ kind: 'essay', title: 'Working from home', prompt: 'Some people say working from home is better than working in an office. Write an essay giving your opinion.', targetWords: ['reliable', 'deadline', 'give up'], minWords: 120, maxWords: 200 })
    await window.api.writing.saveText(e.id, text)
    const t0 = Date.now()
    const res = await window.api.writing.evaluate(e.id)
    return { ms: Date.now() - t0, res }
  }, essay)
  if (!r.res.ok) console.log('ESSAY FAILED:', r.res.code, r.res.message)
  else {
    const ev = r.res.entry.evaluation
    console.log(`ESSAY OK in ${r.ms} ms via ${ev.provider}: overall ${ev.overall}, cefr ${ev.cefr}, scores ${JSON.stringify(ev.scores)}`)
    console.log('summary:', ev.summary)
    console.log('corrections:', JSON.stringify(ev.corrections.map((c) => `${c.original} → ${c.corrected} [${c.category}]`), null, 0))
    console.log('target words:', JSON.stringify(ev.targetWords.map((w) => `${w.word}:${w.used ? (w.correct ? 'ok' : 'wrong') : 'unused'}`)))
  }
  const c = await page.evaluate(async () => {
    const e = await window.api.writing.create({ kind: 'chat', title: 'Reschedule a meeting', prompt: "You cannot come to tomorrow's meeting. Write to your colleague Sam in the work chat.", aiRole: 'a friendly colleague called Sam', register: 'informal', goals: ['say you cannot come and why', 'suggest a new time'], targetWords: [], opening: 'Hi! Are we still on for the meeting tomorrow at 10?' })
    const t0 = Date.now()
    const res = await window.api.writing.chatTurn(e.id, 'Hi Sam. I am afraid I can not come tomorrow, because I am agree to visit the doctor. Can we meet on Thursday?')
    return { ms: Date.now() - t0, res }
  })
  if (!c.res.ok) console.log('CHAT FAILED:', c.res.code, c.res.message)
  else console.log(`CHAT OK in ${c.ms} ms: reply="${c.res.entry.messages.at(-1).content}" | tip="${c.res.entry.messages.at(-2).tip ?? ''}" | done=${c.res.entry.chatDone}`)
}
