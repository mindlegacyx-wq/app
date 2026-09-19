import { Outlet } from 'react-router'

import { BottomNav } from './BottomNav'

/** Layout das 5 abas: conteúdo rolável + barra inferior fixa. */
export function AppShell() {
  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-lg px-5 pb-28">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

/** Layout de página cheia sem abas (entrada, setup, configurações). */
export function PlainLayout() {
  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-lg px-5 pb-10">
        <Outlet />
      </main>
    </div>
  )
}
