import { app, net } from 'electron'
import { parseRelease, UPDATE_REPO, type UpdateInfo } from '@shared/updates'

export type UpdateCheck = { ok: true; info: UpdateInfo } | { ok: false; message: string }

/** Asks GitHub for the latest published release. Nothing is sent but the request itself (no user data). */
export async function checkForUpdate(): Promise<UpdateCheck> {
  if (!UPDATE_REPO) return { ok: false, message: 'Updates are not set up in this build.' }
  try {
    const res = await net.fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `EnglishWorkbook/${app.getVersion()}` },
      signal: AbortSignal.timeout(8000)
    })
    if (res.status === 404) return { ok: false, message: 'No releases published yet.' }
    if (!res.ok) return { ok: false, message: `GitHub answered ${res.status}.` }
    const info = parseRelease(await res.json(), app.getVersion())
    return info ? { ok: true, info } : { ok: false, message: 'The latest release could not be read.' }
  } catch {
    return { ok: false, message: 'Could not reach GitHub — check the internet connection.' }
  }
}
