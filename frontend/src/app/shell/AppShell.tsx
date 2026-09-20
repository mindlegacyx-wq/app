import { m, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'

import { AchievementToast } from '@/features/achievements/AchievementToast'
import { cn } from '@/lib/format'
import { LeagueResultOverlay } from '@/features/league/LeagueResult'
import { PlayerHud } from '@/features/player/PlayerHud'

import { BottomNav } from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { SideNav } from './SideNav'

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

/**
 * Layout das abas. Um app só, dois formatos, decididos pela largura da janela:
 *
 * - celular (< 1024 px): HUD no topo, conteúdo numa coluna, barra de abas embaixo;
 * - PC (>= 1024 px): menu lateral fixo à esquerda, conteúdo mais largo, sem barra embaixo.
 */
export function AppShell() {
  useScrollToTop()
  return (
    <div className="min-h-dvh lg:pl-60">
      <OfflineBanner />
      <PlayerHud />
      <SideNav />
      <main className="mx-auto max-w-lg px-5 pt-4 pb-28 lg:max-w-4xl lg:px-8 lg:pt-6 lg:pb-16">
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

/**
 * Layout de página cheia sem abas (entrada, setup, telas de detalhe).
 *
 * `nav`: no PC as telas internas do app continuam com o menu lateral à esquerda — perder a
 * navegação ao abrir um detalhe é coisa de celular, onde o botão voltar resolve.
 */
export function PlainLayout({ nav = false }: { nav?: boolean }) {
  useScrollToTop()
  return (
    <div className={cn('min-h-dvh', nav && 'lg:pl-60')}>
      <OfflineBanner />
      {nav && <SideNav />}
      <main className="mx-auto max-w-lg px-5 pb-10 lg:max-w-2xl lg:px-8">
        <Fade>
          <Outlet />
        </Fade>
      </main>
    </div>
  )
}
