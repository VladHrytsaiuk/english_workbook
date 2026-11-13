/**
 * GitHub repository the releases are published in, as "owner/name". While empty, the app never contacts the network
 * about updates. Set it once the repository exists (see docs/RELEASING.md).
 */
export const UPDATE_REPO = 'VladHrytsaiuk/english_workbook'

export interface UpdateInfo {
  current: string
  latest: string
  available: boolean
  /** Page of the release with the downloads. */
  url: string
  /** Release notes (Markdown), trimmed. */
  notes: string
}

/** Compares "1.10.0" with "1.9.2" numerically; a leading "v" and a "-beta" suffix are ignored. Returns <0, 0 or >0. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string): number[] => v.replace(/^v/i, '').split('-')[0].split('.').map((n) => Number.parseInt(n, 10) || 0)
  const x = parts(a)
  const y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length, 3); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d
  }
  return 0
}

/** Reads GitHub's "latest release" JSON. Returns null for anything that is not a normal published release. */
export function parseRelease(json: unknown, current: string): UpdateInfo | null {
  const r = json as { tag_name?: unknown; html_url?: unknown; body?: unknown; draft?: unknown; prerelease?: unknown } | null
  if (!r || typeof r.tag_name !== 'string' || r.draft === true || r.prerelease === true) return null
  const latest = r.tag_name.replace(/^v/i, '')
  if (!/^\d+\.\d+(\.\d+)?/.test(latest)) return null
  const url = typeof r.html_url === 'string' && /^https:\/\/github\.com\//.test(r.html_url) ? r.html_url : ''
  return { current, latest, available: compareVersions(latest, current) > 0, url, notes: typeof r.body === 'string' ? r.body.trim().slice(0, 4000) : '' }
}

/** State of the built-in updater (Windows installer builds). */
export type AutoUpdateStatus =
  | { state: 'unsupported' }
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }
