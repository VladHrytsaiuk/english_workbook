import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { Tour } from '@/components/Tour'
import { Sidebar } from '@/components/Sidebar'
import { Toaster } from '@/components/Toaster'
import { TranslatePopover } from '@/components/TranslatePopover'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useResolvedDark } from '@/hooks/useTheme'
import { AppProvider, useApp } from '@/lib/store'
import { scopeKey, setPreferredVoice } from '@/lib/vocab'
import { NotesPage } from '@/pages/NotesPage'
import { ReviewPage } from '@/pages/ReviewPage'
import { RunPage } from '@/pages/run/RunPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SetupPage } from '@/pages/SetupPage'
import { StatsPage } from '@/pages/StatsPage'
import { TestsPage } from '@/pages/TestsPage'
import { TodayPage } from '@/pages/TodayPage'
import { VocabularyPage } from '@/pages/VocabularyPage'

function Shell() {
  const { settings, route, contentLoaded, tourOpen, setTourOpen } = useApp()
  useResolvedDark(settings?.theme)
  setPreferredVoice(settings?.voiceName ?? null)

  // Show the guided tour once, after the workbook folder is set up.
  const autoTour = Boolean(settings?.contentDir && contentLoaded && !settings.tourDone && !tourOpen)
  useEffect(() => {
    if (!autoTour) return
    const t = setTimeout(() => setTourOpen(true), 700)
    return () => clearTimeout(t)
  }, [autoTour, setTourOpen])

  if (!settings) return <div className="drag h-full" />
  if (!settings.contentDir) return <SetupPage />

  const key = route.page === 'run' ? `run-${route.session.id}` : route.page === 'review' ? `review-${scopeKey(route.scope)}-${route.cram ? 'cram' : 'due'}` : route.page
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={key}
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            {route.page === 'today' && <TodayPage />}
            {route.page === 'notes' && <NotesPage />}
            {route.page === 'tests' && <TestsPage />}
            {route.page === 'run' && <RunPage session={route.session} />}
            {route.page === 'vocab' && <VocabularyPage />}
            {route.page === 'review' && <ReviewPage scope={route.scope} cram={route.cram} back={route.back} />}
            {route.page === 'stats' && <StatsPage />}
            {route.page === 'settings' && <SettingsPage />}
          </motion.div>
        </AnimatePresence>
      </main>
      <TranslatePopover />
      <Tour />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <TooltipProvider delayDuration={400}>
        <Shell />
        <Toaster />
      </TooltipProvider>
    </AppProvider>
  )
}
