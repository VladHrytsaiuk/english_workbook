import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp } from '@/lib/store'
import { type AutoUpdateStatus, UPDATE_REPO, type UpdateInfo } from '@shared/updates'

const KEY = 'update.lastCheck'
const DAY = 24 * 60 * 60 * 1000

/** Looks for a newer release at most once a day (when enabled) and offers the download page. */
export function useUpdateCheck(active = true): UpdateInfo | null {
  const { settings } = useApp()
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const enabled = active && Boolean(UPDATE_REPO) && settings?.checkUpdates !== false && Boolean(settings)
  useEffect(() => {
    if (!enabled) return
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { at: number; info: UpdateInfo } | null
      if (saved && Date.now() - saved.at < DAY) {
        setInfo(saved.info.available ? saved.info : null)
        return
      }
    } catch {
      /* ignore */
    }
    void window.api.app.checkUpdate().then((r) => {
      if (!r.ok) return
      try {
        localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), info: r.info }))
      } catch {
        /* ignore */
      }
      setInfo(r.info.available ? r.info : null)
    })
  }, [enabled])
  return info
}

/** State of the built-in updater (Windows installer); `unsupported` where it does not apply. */
export function useAutoUpdate(): AutoUpdateStatus {
  const [status, setStatus] = useState<AutoUpdateStatus>({ state: 'idle' })
  useEffect(() => {
    void window.api.app.updateStatus().then(setStatus)
    return window.api.app.onUpdateStatus(setStatus)
  }, [])
  return status
}

export function UpdateBanner() {
  const auto = useAutoUpdate()
  const info = useUpdateCheck(auto.state === 'unsupported')
  if (auto.state === 'downloading')
    return (
      <div className="mx-2.5 mb-2 rounded-lg border bg-muted/50 px-2.5 py-2 text-[12.5px]">
        <div className="flex items-center gap-2">
          <Download className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium">Downloading update{auto.version ? ` ${auto.version}` : ''}…</span>
          <span className="ml-auto tabular-nums text-muted-foreground">{auto.percent}%</span>
        </div>
      </div>
    )
  if (auto.state === 'ready')
    return (
      <button
        onClick={() => void window.api.app.installUpdate()}
        className="mx-2.5 mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.08] px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-emerald-500/[0.14]"
      >
        <Download className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="min-w-0">
          <span className="block font-medium">Update {auto.version} is ready</span>
          <span className="block truncate text-muted-foreground">Restart to install</span>
        </span>
      </button>
    )
  if (auto.state !== 'unsupported') return null
  if (!info) return null
  return (
    <button
      onClick={() => void window.api.app.openExternal(info.url || `https://github.com/${UPDATE_REPO}/releases/latest`)}
      className="mx-2.5 mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.08] px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-emerald-500/[0.14]"
    >
      <Download className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span className="min-w-0">
        <span className="block font-medium">Update {info.latest} available</span>
        <span className="block truncate text-muted-foreground">Download the new version</span>
      </span>
    </button>
  )
}
