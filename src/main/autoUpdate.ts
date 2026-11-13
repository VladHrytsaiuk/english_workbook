import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { type AutoUpdateStatus, UPDATE_REPO } from '@shared/updates'
import { getSettings } from './data'

/**
 * In-place updates for the Windows installer build: the new version is downloaded in the background and installed on
 * restart. Not for the portable build (it has no installer to replace), nor for macOS (that needs a signed app) — those
 * only get the "update available" notice.
 */
export const autoUpdateSupported = (): boolean => process.platform === 'win32' && app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR && Boolean(UPDATE_REPO)

let status: AutoUpdateStatus = { state: 'unsupported' }
let started = false

export const getAutoUpdateStatus = (): AutoUpdateStatus => status

function set(next: AutoUpdateStatus): void {
  status = next
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('update:status', status)
}

/** Sets the updater up once and checks right away when allowed by the settings. */
export function initAutoUpdate(): void {
  if (started || !autoUpdateSupported()) return
  started = true
  const [owner, repo] = UPDATE_REPO.split('/')
  autoUpdater.setFeedURL({ provider: 'github', owner, repo })
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => set({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => set({ state: 'idle' }))
  autoUpdater.on('update-available', (i) => set({ state: 'downloading', version: i.version, percent: 0 }))
  autoUpdater.on('download-progress', (p) => set({ state: 'downloading', version: status.state === 'downloading' ? status.version : '', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (i) => set({ state: 'ready', version: i.version }))
  autoUpdater.on('error', (e) => set({ state: 'error', message: e?.message?.split('\n')[0] ?? 'Update failed' }))
  set({ state: 'idle' })
  if (getSettings().checkUpdates) void checkAutoUpdate()
}

export async function checkAutoUpdate(): Promise<void> {
  if (!autoUpdateSupported()) return
  initAutoUpdate()
  if (status.state === 'checking' || status.state === 'downloading' || status.state === 'ready') return
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    set({ state: 'error', message: e instanceof Error ? e.message.split('\n')[0] : 'Update failed' })
  }
}

export function installUpdate(): void {
  if (status.state === 'ready') autoUpdater.quitAndInstall(false, true)
}
