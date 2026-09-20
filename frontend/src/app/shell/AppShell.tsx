import { m, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'

import { AchievementToast } from '@/features/achievements/AchievementToast'
import { LeagueResultOverlay } from '@/features/league/LeagueResult'
import { PlayerHud } from '@/features/player/PlayerHud'

import { BottomNav } from './BottomNav'
import { OfflineBanner } from './OfflineBanner'

/** Cada rota começa no topo (o navegador não faz isso sozinho num SPA). */
function useScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
}

/** Cada tela entra com um fade curto: dá continuidade sem atrasar o toque. */
function Fade({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const reduced = useReducedMotion()
  return (
    <m.div
      key={pathname}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.22, ease: [0.25, 1, 0.5, 1] }}
    >
      {children}
    </m.div>
  )
}

/** Layout das abas: HUD de XP no topo, conteúdo rolável e barra inferior fixa. */
export function AppShell() {
  useScrollToTop()
  return (
    <div className="min-h-dvh">
      <OfflineBanner />
      <PlayerHud />
      <main className="mx-auto max-w-lg px-5 pt-4 pb-28">
        <Fade>
          <Outlet />
        </Fade>
      </main>
      <BottomNav />
      <AchievementToast />
      <LeagueResultOverlay />
    </div>
  )
}

/** Layout de página cheia sem abas (entrada, setup, configurações). */
export function PlainLayout() {
  useScrollToTop()
  return (
    <div className="min-h-dvh">
      <OfflineBanner />
      <main className="mx-auto max-w-lg px-5 pb-10">
        <Fade>
          <Outlet />
        </Fade>
      </main>
    </div>
  )
}
