import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'

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

/** Layout das abas: HUD de XP no topo, conteúdo rolável e barra inferior fixa. */
export function AppShell() {
  useScrollToTop()
  return (
    <div className="min-h-dvh">
      <OfflineBanner />
      <PlayerHud />
      <main className="mx-auto max-w-lg px-5 pt-4 pb-28">
        <Outlet />
      </main>
      <BottomNav />
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
        <Outlet />
      </main>
    </div>
  )
}
