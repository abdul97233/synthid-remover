import { useEffect } from 'react'
import type { MouseEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
import { MobileTabBar } from './components/layout/MobileTabBar'
import { useHashRoute } from './lib/router'
import { EASE } from './components/ui/Motion'
import { HomePage } from './pages/HomePage'
import { WorkspacePage } from './pages/WorkspacePage'
import { LabsPage } from './pages/LabsPage'

let HOME_TITLE = ''

export default function App() {
  const route = useHashRoute()
  const reduce = useReducedMotion()

  // Per-route document title (the home title lives in index.html for crawlers).
  useEffect(() => {
    if (!HOME_TITLE) HOME_TITLE = document.title
    document.title =
      route === '/app' ? 'Workspace — SynthID Remover' : route === '/labs' ? 'Labs (experimental) — SynthID Remover' : HOME_TITLE
  }, [route])

  // Skip link must not touch the hash (the hash is the router).
  const skipToMain = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    document.getElementById('main-content')?.focus()
  }

  return (
    <div className="relative flex min-h-screen flex-col pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-0">
      <a
        href="#main-content"
        onClick={skipToMain}
        className="sr-only z-[60] rounded-lg bg-card px-4 py-2 text-sm font-medium shadow-card focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <AnimatePresence
          mode="wait"
          initial={false}
          // Scroll to top once the old route has left, before the new one enters.
          onExitComplete={() => window.scrollTo({ top: 0, behavior: 'instant' })}
        >
          <motion.div
            key={route}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6, transition: { duration: 0.16, ease: EASE } }}
            transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
          >
            {route === '/app' ? <WorkspacePage /> : route === '/labs' ? <LabsPage /> : <HomePage />}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  )
}
