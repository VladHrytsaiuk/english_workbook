import { FileText, FolderOpen, Keyboard, PlayCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { SHORTCUTS } from '@/lib/shortcuts'
import { useApp } from '@/lib/store'

export function HelpDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const { setTourOpen } = useApp()
  const item = 'flex w-full items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-left text-[13.5px] transition-colors hover:border-primary/40 hover:bg-primary/[0.04]'
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogTitle>Help</DialogTitle>
        <DialogDescription>How EnglishWorkbook works and where things are.</DialogDescription>
        <div className="grid gap-2">
          <button
            className={item}
            onClick={() => {
              onClose()
              setTimeout(() => setTourOpen(true), 150)
            }}
          >
            <PlayCircle className="size-4 text-primary" />
            <span className="flex-1">
              <span className="font-medium">Take the tour</span>
              <span className="block text-[12px] text-muted-foreground">A one-minute walk through every section (in Ukrainian)</span>
            </span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button className={item} onClick={() => void window.api.content.openSpec('TEST_FORMAT.md')}>
              <FileText className="size-4 text-muted-foreground" />
              <span>
                <span className="font-medium">Test format</span>
                <span className="block text-[12px] text-muted-foreground">TEST_FORMAT.md</span>
              </span>
            </button>
            <button className={item} onClick={() => void window.api.content.openSpec('VOCAB_FORMAT.md')}>
              <FileText className="size-4 text-muted-foreground" />
              <span>
                <span className="font-medium">Word list format</span>
                <span className="block text-[12px] text-muted-foreground">VOCAB_FORMAT.md</span>
              </span>
            </button>
          </div>
          <button className={item} onClick={() => void window.api.content.openFolder()}>
            <FolderOpen className="size-4 text-muted-foreground" />
            <span className="font-medium">Open the workbook folder</span>
          </button>
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            <Keyboard className="size-3.5" /> Keyboard
          </div>
          <div className="max-h-56 divide-y overflow-y-auto rounded-lg border text-[12.5px]">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="text-muted-foreground">{v}</span>
                <Kbd className="h-5 shrink-0 px-1.5 text-[11px]">{k}</Kbd>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
