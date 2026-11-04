import { useEffect, useRef } from 'react'

/** Registers a window keydown listener with a stable reference to the latest handler. */
export function useKeydown(handler: (e: KeyboardEvent) => void, active = true): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!active) return
    const on = (e: KeyboardEvent): void => ref.current(e)
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [active])
}
