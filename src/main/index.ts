import { app, BrowserWindow, nativeTheme, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { setVocabularyListener, stopWatching } from './content'
import { getSettings, updateSettings } from './data'
import { activateWorkbook, applyTheme, registerIpc } from './ipc'
import { syncVocabularyFolder } from './vocabFiles'

// Isolated profile for automated smoke tests / development (never set in production).
if (process.env.EW_USER_DATA) app.setPath('userData', process.env.EW_USER_DATA)

app.setName('EnglishWorkbook')

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0b0d' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // Links in notes open in the default browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    if (devUrl && url.startsWith(devUrl)) return
    e.preventDefault()
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
  })

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}

app.whenReady().then(async () => {
  registerIpc()
  const settings = getSettings()
  applyTheme(settings.theme)
  if (settings.contentDir && !existsSync(settings.contentDir)) {
    // The folder was moved or deleted: ask for it again on the setup screen.
    updateSettings({ contentDir: null })
  } else if (settings.contentDir) {
    await activateWorkbook(settings.contentDir)
  }
  setVocabularyListener(() => {
    const dir = getSettings().contentDir
    if (dir) void syncVocabularyFolder(dir)
  })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void stopWatching()
})
