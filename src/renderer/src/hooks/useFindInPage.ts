import { useCallback, useEffect, useState } from 'react'

type Registry = Map<string, unknown>
const registry = (): Registry | undefined => (CSS as unknown as { highlights?: Registry }).highlights
const Highlight = (): (new (...r: Range[]) => unknown) | undefined => (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight

/** Every case-insensitive occurrence of `query` in the element's text, also when it spans inline tags (e.g. "was <b>going</b>"). */
export function findRanges(root: HTMLElement, query: string): Range[] {
  const needle = query.toLowerCase()
  if (!needle) return []
  const nodes: { node: Text; start: number }[] = []
  let text = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    nodes.push({ node, start: text.length })
    text += node.data
  }
  const hay = text.toLowerCase()
  /** The text node holding `offset`: the last one starting at or before it (for an end offset: strictly before it). */
  const at = (offset: number, end: boolean): [Text, number] => {
    let lo = 0
    let hi = nodes.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (end ? nodes[mid].start < offset : nodes[mid].start <= offset) lo = mid
      else hi = mid - 1
    }
    const n = nodes[lo]
    return [n.node, Math.min(n.node.data.length, Math.max(0, offset - n.start))]
  }
  const ranges: Range[] = []
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) {
    const r = new Range()
    const [a, ao] = at(i, false)
    const [b, bo] = at(i + needle.length, true)
    r.setStart(a, ao)
    r.setEnd(b, bo)
    ranges.push(r)
  }
  return ranges
}

/**
 * Find-in-page for one reader (⌘F), with "n of m" and next/previous. Highlights use the CSS Custom Highlight API,
 * so the rendered Markdown is never modified. `contentKey` re-runs the search when another note is shown.
 */
export function useFindInPage(container: React.RefObject<HTMLElement | null>, contentKey: string | undefined) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)
  const [ranges, setRanges] = useState<Range[]>([])

  useEffect(() => {
    const el = container.current
    setRanges(open && el && query ? findRanges(el, query) : [])
    setCurrent(0)
  }, [container, open, query, contentKey])

  useEffect(() => {
    setCount(ranges.length)
    const reg = registry()
    const H = Highlight()
    if (!reg || !H) return
    reg.delete('find')
    reg.delete('find-current')
    if (!ranges.length) return
    const now = ranges[Math.min(current, ranges.length - 1)]
    reg.set('find', new H(...ranges))
    reg.set('find-current', new H(now))
    const scroller = container.current?.closest('[data-scroll]')
    const rect = now.getBoundingClientRect()
    if (scroller) {
      const box = scroller.getBoundingClientRect()
      if (rect.top < box.top + 60 || rect.bottom > box.bottom - 60)
        scroller.scrollTo({
          top: scroller.scrollTop + rect.top - box.top - box.height / 3,
          behavior: 'smooth'
        })
    }
    return () => {
      reg.delete('find')
      reg.delete('find-current')
    }
  }, [ranges, current, container])

  const step = useCallback((dir: 1 | -1) => setCurrent((c) => (count ? (c + dir + count) % count : 0)), [count])
  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])
  return { open, setOpen, query, setQuery, current, count, step, close }
}
