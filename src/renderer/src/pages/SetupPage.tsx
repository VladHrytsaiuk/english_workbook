import { motion } from 'framer-motion'
import { FolderOpen, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/store'

export function SetupPage() {
  const { setSettings, toast } = useApp()
  const [defaultDir, setDefaultDir] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.api.content.defaultDir().then(setDefaultDir)
  }, [])

  const setup = async (dir: string): Promise<void> => {
    setBusy(true)
    try {
      const { created, settings } = await window.api.content.setup(dir)
      setSettings(settings)
      toast(created.length ? `Workbook ready — added ${created.length} example files.` : 'Workbook folder connected.', 'success')
    } catch (e) {
      toast(`Couldn't use this folder: ${String(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const choose = async (): Promise<void> => {
    const dir = await window.api.content.chooseFolder()
    if (dir) await setup(dir)
  }

  const pretty = defaultDir.replace(/^\/Users\/[^/]+/, '~').replace(/^[A-Z]:\\Users\\[^\\]+/i, '~')

  return (
    <div className="drag flex h-full items-center justify-center bg-gradient-to-b from-background to-muted/40 p-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="no-drag w-full max-w-[460px] rounded-2xl border bg-card p-8 shadow-xl"
      >
        <div className="mb-6 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-base font-bold text-white shadow-md">Ew</div>
        <h1 className="text-[22px] font-semibold tracking-tight">Welcome to EnglishWorkbook</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Your notes and tests live as Markdown files in a folder on this computer. Pick where it should be — the app creates <code className="rounded bg-muted px-1">notes/</code> and{' '}
          <code className="rounded bg-muted px-1">tests/</code> with a few examples and watches it for changes.
        </p>
        <div className="mt-6 flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-[13px]">{pretty || '…'}</span>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Button size="lg" disabled={!defaultDir || busy} onClick={() => void setup(defaultDir)} autoFocus>
            <Sparkles /> Use this folder
          </Button>
          <Button size="lg" variant="ghost" disabled={busy} onClick={() => void choose()}>
            Choose another folder…
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
