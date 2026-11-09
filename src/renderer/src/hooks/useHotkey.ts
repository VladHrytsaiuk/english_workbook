import { createContext, useContext, useEffect, useRef } from 'react'

/** False for a view that is kept alive but hidden (a paused test): its keyboard shortcuts must stay silent. */
export const ViewActive = createContext(true)

/** Registers a window keydown listener with a stable reference to the latest handler. */
export function useKeydown(handler: (e: KeyboardEvent) => void, activeProp = true): void {
  const viewActive = useContext(ViewActive)
  const active = activeProp && viewActive
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!active) return
    const on = (e: KeyboardEvent): void => ref.current(e)
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [active])
}
