import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { type Route, useApp } from '@/lib/store'
import { modKey } from '@/lib/utils'
import { Button } from './ui/button'
import { Kbd } from './ui/kbd'

interface TourStep {
  /** Page to open before the step is shown. */
  route?: Route
  /** `data-tour` attribute of the element to highlight; centred card when missing or not found. */
  target?: string
  title: string
  body: React.ReactNode
  placement?: 'right' | 'left' | 'bottom' | 'top'
}

const STEPS: TourStep[] = [
  {
    route: { page: 'today' },
    title: 'Вітаю в EnglishWorkbook 👋',
    body: (
      <>
        Коротка екскурсія на хвилину: покажу, де що лежить і як цим користуватися. Пропустити можна будь-коли (<Kbd>Esc</Kbd>), а повернутися до туру — кнопкою <b>?</b> внизу зліва.
      </>
    )
  },
  {
    route: { page: 'today' },
    target: 'plan',
    placement: 'bottom',
    title: 'Сьогодні — з чого почати',
    body: 'Щодня тут готовий план: повторити слова, виправити помилки, потренувати найслабшу тему й спробувати тест. Кожен пункт запускається однією кнопкою, а виконані відмічаються галочкою. Нижче — серія днів і активність.'
  },
  {
    target: 'nav',
    placement: 'right',
    title: 'Розділи',
    body: (
      <>
        <b>Today</b> — план на день, <b>Notes</b> — шпаргалки, <b>Tests</b> — тести, <b>Vocabulary</b> — ваші слова, <b>Stats</b> — прогрес. Перемикайтеся клавішами <Kbd>{modKey}1</Kbd>–<Kbd>{modKey}5</Kbd>, налаштування —{' '}
        <Kbd>{modKey},</Kbd>.
      </>
    )
  },
  {
    route: { page: 'notes' },
    target: 'notes-list',
    placement: 'right',
    title: 'Нотатки',
    body: (
      <>
        Це ваші Markdown-файли з папки <code>notes/</code> у робочій папці. Додайте чи змініть файл у будь-якому редакторі — список оновиться сам. Пошук по всіх нотатках — <Kbd>{modKey}F</Kbd>.
      </>
    )
  },
  {
    route: { page: 'notes' },
    target: 'note-body',
    placement: 'left',
    title: 'Переклад виділенням',
    body: (
      <>
        Виділіть будь-яке слово чи фразу — поруч з'явиться переклад українською (з поясненням граматики, якщо провайдер Gemini чи Claude). Кнопка <b>Save</b> додає слово в словник разом із реченням, де ви його знайшли. Так само працює в
        тестах і текстах для читання.
      </>
    )
  },
  {
    route: { page: 'tests' },
    target: 'tests-list',
    placement: 'bottom',
    title: 'Тести',
    body: (
      <>
        Файли з папки <code>tests/</code>. Формат описано в <code>TEST_FORMAT.md</code> — дайте його Claude чи Gemini, і вони згенерують тест. У тесті: <Kbd>↵</Kbd> — перевірити, <Kbd>1</Kbd>–<Kbd>4</Kbd> — вибрати варіант;
        пояснення з'являється після відповіді, а помилки потрапляють у банк помилок.
      </>
    )
  },
  {
    route: { page: 'vocab' },
    target: 'vocab-nav',
    placement: 'right',
    title: 'Словник',
    body: (
      <>
        Колоди, теми, теги й розумні списки (<i>Due now, New, Difficult…</i>). Слова можна додавати й файлами в папці <code>vocabulary/</code> (формат — <code>VOCAB_FORMAT.md</code>), дублі не створюються. Кнопка{' '}
        <b>Fill with AI</b> додає транскрипцію, приклади й тему.
      </>
    )
  },
  {
    route: { page: 'vocab' },
    target: 'vocab-review',
    placement: 'bottom',
    title: 'Повторення слів',
    body: (
      <>
        <b>Review</b> (або <Kbd>R</Kbd>) запускає повторення за алгоритмом FSRS: слово повертається якраз перед тим, як ви б його забули. Режими чергуються: картка, вписати слово, пропуск у вашому реченні, вибір перекладу.
        Оцінюйте себе клавішами <Kbd>1</Kbd>–<Kbd>4</Kbd> — Again, Hard, Good, Easy.
      </>
    )
  },
  {
    route: { page: 'stats' },
    target: 'stats',
    placement: 'bottom',
    title: 'Прогрес',
    body: 'Точність за темами й у часі, банк помилок (питання виходить з нього після двох правильних відповідей поспіль) і статистика словника з прогнозом повторень.'
  },
  {
    route: { page: 'settings' },
    target: 'settings-translation',
    placement: 'left',
    title: 'Переклад і ключі',
    body: 'Оберіть провайдера перекладу й вставте API-ключ (у Gemini є безкоштовний). Ключі шифруються і зберігаються лише на цьому Маку. Тут же — ліміти повторень, голос для озвучення та тема оформлення.'
  },
  {
    target: 'help',
    placement: 'top',
    title: 'Допомога завжди тут',
    body: 'Кнопка «?» — повторити цей тур, подивитися гарячі клавіші й відкрити описи форматів файлів.'
  },
  {
    route: { page: 'today' },
    title: 'Готово! 🎉',
    body: 'Почніть із плану на сьогодні: виділяйте незнайомі слова в нотатках, проходьте тести й щодня трохи повторюйте. Успіхів з англійською!'
  }
]

const CARD_W = 360
const PAD = 8

export function Tour() {
  const { tourOpen, setTourOpen, navigate, route, updateSettings } = useApp()
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardH, setCardH] = useState(200)
  const cardRef = useRef<HTMLDivElement>(null)
  const step = STEPS[i]

  const close = useCallback(
    (finished: boolean) => {
      setTourOpen(false)
      setI(0)
      void updateSettings({ tourDone: true })
      if (finished) navigate({ page: 'today' })
    },
    [setTourOpen, updateSettings, navigate]
  )

  // Open the step's page.
  useEffect(() => {
    if (!tourOpen || !step.route) return
    if (route.page !== step.route.page) navigate(step.route)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOpen, i])

  // Track the highlighted element (it can move while pages animate in).
  useEffect(() => {
    if (!tourOpen) return
    setRect(null)
    if (!step.target) return
    const measure = (): void => {
      const el = document.querySelector(`[data-tour="${step.target}"]`)
      const r = el?.getBoundingClientRect()
      setRect((prev) => (r && r.width > 0 ? (prev && prev.x === r.x && prev.y === r.y && prev.width === r.width && prev.height === r.height ? prev : r) : null))
    }
    measure()
    const t = setInterval(measure, 120)
    return () => clearInterval(t)
  }, [tourOpen, i, step.target])

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight)
  }, [i, rect, tourOpen])

  const next = useCallback(() => (i < STEPS.length - 1 ? setI(i + 1) : close(true)), [i, close])
  const back = useCallback(() => setI((x) => Math.max(0, x - 1)), [])

  // Keyboard: handled in the capture phase so pages underneath don't react (e.g. Enter starting a test).
  useEffect(() => {
    if (!tourOpen) return
    const on = (e: KeyboardEvent): void => {
      if (['ArrowRight', 'Enter', 'ArrowLeft', 'Escape'].includes(e.key) || ((e.metaKey || e.ctrlKey) && /^[1-5,]$/.test(e.key))) {
        e.preventDefault()
        e.stopPropagation()
      }
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') back()
      else if (e.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', on, true)
    return () => window.removeEventListener('keydown', on, true)
  }, [tourOpen, next, back, close])

  if (!tourOpen) return null

  // Card position next to the highlighted element, kept inside the window.
  const vw = window.innerWidth
  const vh = window.innerHeight
  let pos: { left: number; top: number }
  if (rect) {
    const p = step.placement ?? 'bottom'
    const r = { left: rect.left - PAD, top: rect.top - PAD, right: rect.right + PAD, bottom: rect.bottom + PAD }
    let left =
      p === 'right' ? r.right + 14 : p === 'left' ? r.left - CARD_W - 14 : Math.min(Math.max(rect.left + rect.width / 2 - CARD_W / 2, 16), vw - CARD_W - 16)
    let top = p === 'bottom' ? r.bottom + 14 : p === 'top' ? r.top - cardH - 14 : Math.min(Math.max(rect.top, 16), vh - cardH - 16)
    // Not enough room → fall back inside the viewport.
    if (left + CARD_W > vw - 16) left = vw - CARD_W - 16
    if (left < 16) left = 16
    if (top + cardH > vh - 16) top = Math.max(16, (p === 'bottom' ? r.top - cardH - 14 : vh - cardH - 16))
    if (top < 16) top = 16
    pos = { left, top }
  } else {
    pos = { left: vw / 2 - CARD_W / 2, top: vh / 2 - cardH / 2 }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200]" data-no-translate>
      {/* Click shield */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {rect ? (
        <motion.div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary/70"
          initial={false}
          animate={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          style={{ boxShadow: '0 0 0 9999px rgba(10, 10, 20, 0.58)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(10,10,20,0.58)] backdrop-blur-[1px]" />
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          ref={cardRef}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{ duration: 0.18 }}
          style={{ left: pos.left, top: pos.top, width: CARD_W }}
          className="absolute rounded-2xl border bg-popover p-5 text-popover-foreground shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11.5px] font-medium tabular-nums text-muted-foreground">
              {i + 1} / {STEPS.length}
            </span>
            <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => close(false)} aria-label="Skip tour" title="Skip (Esc)">
              <X className="size-3.5" />
            </button>
          </div>
          <h3 className="text-[16px] font-semibold tracking-tight">{step.title}</h3>
          <div className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-[12px] [&_code]:text-foreground">
            {step.body}
          </div>
          <div className="mt-4 flex items-center gap-1">
            {STEPS.map((_, k) => (
              <span key={k} className={`h-1 rounded-full transition-all ${k === i ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/25'}`} />
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              {i === 0 ? (
                <Button size="sm" variant="ghost" onClick={() => close(false)}>
                  Пропустити
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={back}>
                  <ArrowLeft /> Назад
                </Button>
              )}
              <Button size="sm" onClick={next}>
                {i === 0 ? 'Почати' : i === STEPS.length - 1 ? 'Готово' : 'Далі'} {i < STEPS.length - 1 && <ArrowRight />}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  )
}
