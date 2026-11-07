// Recognising the grammatical forms of a saved word inside a sentence, so that "give up" is found in
// "She is giving up" / "He gave up" / "They have given up". No dictionary is needed: regular endings are generated
// by rules and the common irregular verbs are listed.

const IRREGULAR: Record<string, string[]> = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  have: ['has', 'had', 'having'],
  do: ['does', 'did', 'done', 'doing'],
  go: ['goes', 'went', 'gone', 'going'],
  get: ['gets', 'got', 'gotten', 'getting'],
  give: ['gives', 'gave', 'given', 'giving'],
  take: ['takes', 'took', 'taken', 'taking'],
  make: ['makes', 'made', 'making'],
  come: ['comes', 'came', 'coming'],
  see: ['sees', 'saw', 'seen', 'seeing'],
  know: ['knows', 'knew', 'known', 'knowing'],
  think: ['thinks', 'thought', 'thinking'],
  say: ['says', 'said', 'saying'],
  tell: ['tells', 'told', 'telling'],
  find: ['finds', 'found', 'finding'],
  leave: ['leaves', 'left', 'leaving'],
  keep: ['keeps', 'kept', 'keeping'],
  let: ['lets', 'letting'],
  begin: ['begins', 'began', 'begun', 'beginning'],
  bring: ['brings', 'brought', 'bringing'],
  buy: ['buys', 'bought', 'buying'],
  build: ['builds', 'built', 'building'],
  catch: ['catches', 'caught', 'catching'],
  choose: ['chooses', 'chose', 'chosen', 'choosing'],
  cost: ['costs', 'costing'],
  cut: ['cuts', 'cutting'],
  deal: ['deals', 'dealt', 'dealing'],
  draw: ['draws', 'drew', 'drawn', 'drawing'],
  drink: ['drinks', 'drank', 'drunk', 'drinking'],
  drive: ['drives', 'drove', 'driven', 'driving'],
  eat: ['eats', 'ate', 'eaten', 'eating'],
  fall: ['falls', 'fell', 'fallen', 'falling'],
  feed: ['feeds', 'fed', 'feeding'],
  feel: ['feels', 'felt', 'feeling'],
  fight: ['fights', 'fought', 'fighting'],
  fly: ['flies', 'flew', 'flown', 'flying'],
  forget: ['forgets', 'forgot', 'forgotten', 'forgetting'],
  forgive: ['forgives', 'forgave', 'forgiven', 'forgiving'],
  grow: ['grows', 'grew', 'grown', 'growing'],
  hang: ['hangs', 'hung', 'hanging'],
  hear: ['hears', 'heard', 'hearing'],
  hide: ['hides', 'hid', 'hidden', 'hiding'],
  hit: ['hits', 'hitting'],
  hold: ['holds', 'held', 'holding'],
  hurt: ['hurts', 'hurting'],
  lay: ['lays', 'laid', 'laying'],
  lead: ['leads', 'led', 'leading'],
  learn: ['learns', 'learnt', 'learned', 'learning'],
  lend: ['lends', 'lent', 'lending'],
  lie: ['lies', 'lay', 'lain', 'lying'],
  lose: ['loses', 'lost', 'losing'],
  mean: ['means', 'meant', 'meaning'],
  meet: ['meets', 'met', 'meeting'],
  pay: ['pays', 'paid', 'paying'],
  put: ['puts', 'putting'],
  quit: ['quits', 'quitting'],
  read: ['reads', 'reading'],
  ride: ['rides', 'rode', 'ridden', 'riding'],
  ring: ['rings', 'rang', 'rung', 'ringing'],
  rise: ['rises', 'rose', 'risen', 'rising'],
  run: ['runs', 'ran', 'running'],
  sell: ['sells', 'sold', 'selling'],
  send: ['sends', 'sent', 'sending'],
  set: ['sets', 'setting'],
  shake: ['shakes', 'shook', 'shaken', 'shaking'],
  shoot: ['shoots', 'shot', 'shooting'],
  show: ['shows', 'showed', 'shown', 'showing'],
  shut: ['shuts', 'shutting'],
  sing: ['sings', 'sang', 'sung', 'singing'],
  sit: ['sits', 'sat', 'sitting'],
  sleep: ['sleeps', 'slept', 'sleeping'],
  speak: ['speaks', 'spoke', 'spoken', 'speaking'],
  spend: ['spends', 'spent', 'spending'],
  stand: ['stands', 'stood', 'standing'],
  steal: ['steals', 'stole', 'stolen', 'stealing'],
  stick: ['sticks', 'stuck', 'sticking'],
  swim: ['swims', 'swam', 'swum', 'swimming'],
  teach: ['teaches', 'taught', 'teaching'],
  tear: ['tears', 'tore', 'torn', 'tearing'],
  throw: ['throws', 'threw', 'thrown', 'throwing'],
  understand: ['understands', 'understood', 'understanding'],
  wake: ['wakes', 'woke', 'woken', 'waking'],
  wear: ['wears', 'wore', 'worn', 'wearing'],
  win: ['wins', 'won', 'winning'],
  write: ['writes', 'wrote', 'written', 'writing'],
  break: ['breaks', 'broke', 'broken', 'breaking'],
  burn: ['burns', 'burnt', 'burned', 'burning'],
  dig: ['digs', 'dug', 'digging'],
  light: ['lights', 'lit', 'lighted', 'lighting'],
  pick: ['picks', 'picked', 'picking'],
  turn: ['turns', 'turned', 'turning'],
  work: ['works', 'worked', 'working']
}

const VOWEL = /[aeiou]/

/** The word and its common forms: -s/-es, -ed, -ing (with e-drop, y→ied, consonant doubling) and irregular verb forms. */
export function inflections(word: string): string[] {
  const w = word.toLowerCase()
  const out = new Set<string>([w])
  for (const f of IRREGULAR[w] ?? []) out.add(f)
  if (w.length < 2) return [...out]

  const consonantY = /[^aeiou]y$/.test(w)
  if (consonantY) {
    out.add(w.slice(0, -1) + 'ies')
    out.add(w.slice(0, -1) + 'ied')
  } else {
    out.add(/(s|x|z|ch|sh|o)$/.test(w) ? w + 'es' : w + 's')
    out.add(w.endsWith('e') ? w + 'd' : w + 'ed')
  }
  if (w.endsWith('ie')) out.add(w.slice(0, -2) + 'ying')
  else if (w.endsWith('e') && !/(ee|ye|oe)$/.test(w)) out.add(w.slice(0, -1) + 'ing')
  else out.add(w + 'ing')
  // stop → stopped / stopping (one short stressed syllable doubles its last consonant; harmless extra forms elsewhere)
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(w) && VOWEL.test(w)) {
    const d = w + w[w.length - 1]
    out.add(d + 'ed')
    out.add(d + 'ing')
  }
  return [...out]
}

/**
 * Forms of a saved word or phrase: "give up" → "gave up", "giving up"…; a noun phrase also takes a plural
 * ("dentist appointment" → "dentist appointments"). A leading "to" / article is dropped.
 */
export function phraseForms(text: string): string[] {
  const bare = text.trim().replace(/^(to|a|an|the)\s+(?=\S)/i, '')
  const words = bare.split(/\s+/).filter(Boolean)
  if (!words.length) return []
  if (words.length === 1) return inflections(words[0])
  const first = inflections(words[0]).map((f) => [f, ...words.slice(1)].join(' '))
  const last = inflections(words[words.length - 1]).map((f) => [...words.slice(0, -1), f].join(' '))
  return [...new Set([...first, ...last])]
}
