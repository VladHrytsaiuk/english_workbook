import { useEffect, useState } from 'react'
import type { ThemePref } from '@shared/types'

/** Resolves the theme preference to light/dark (following the OS for "system") and applies it. */
export function useResolvedDark(pref: ThemePref | undefined): boolean {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const [systemDark, setSystemDark] = useState(mq.matches)
  useEffect(() => {
    const on = (): void => setSystemDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [mq])
  const dark = pref === 'dark' || (pref !== 'light' && systemDark)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])
  return dark
}
