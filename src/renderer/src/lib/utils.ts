import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function uid(): string {
  return crypto.randomUUID()
}

export function shuffle<T>(arr: readonly T[], seed?: number): T[] {
  const a = [...arr]
  let s = seed ?? Math.floor(Math.random() * 2 ** 31)
  const rand = (): number => {
    // mulberry32 – deterministic when a seed is given
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Shuffles so that the result differs from the original order when possible. */
export function shuffleDifferent<T>(arr: readonly T[]): T[] {
  if (arr.length < 2) return [...arr]
  for (let i = 0; i < 10; i++) {
    const s = shuffle(arr)
    if (s.some((x, j) => x !== arr[j])) return s
  }
  return [...arr].reverse()
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return new Date(iso).toLocaleDateString('en-GB', opts)
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d} d ago`
  return formatDate(iso)
}

export const pct = (a: number, b: number): number => (b ? Math.round((a / b) * 100) : 0)

export const isMac = navigator.userAgent.includes('Mac')
export const modKey = isMac ? '⌘' : 'Ctrl'

/** True when the keyboard event target is a text field (so global shortcuts should not fire). */
export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`
