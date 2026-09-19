import { Navigate, Outlet, useLocation } from 'react-router'

import { Spinner } from '@/components/ui'
import { isOnboarded, useAuth } from '@/lib/auth-store'

function Booting() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-6 text-ink-faint" />
    </div>
  )
}

/** Exige sessão. Sem sessão → boas-vindas. Com sessão mas sem setup → /setup. */
export function RequireAuth() {
  const status = useAuth((s) => s.status)
  const user = useAuth((s) => s.user)
  const location = useLocation()

  if (status === 'booting') return <Booting />
  if (status === 'anon') return <Navigate to="/bem-vindo" replace state={{ from: location.pathname }} />
  if (!isOnboarded(user) && location.pathname !== '/setup') return <Navigate to="/setup" replace />
  return <Outlet />
}

/** Rotas públicas: quem já está logado não vê boas-vindas/login de novo. */
export function RedirectIfAuthed() {
  const status = useAuth((s) => s.status)
  const user = useAuth((s) => s.user)

  if (status === 'booting') return <Booting />
  if (status === 'authed') return <Navigate to={isOnboarded(user) ? '/hoje' : '/setup'} replace />
  return <Outlet />
}

/** "/" decide para onde ir. */
export function RootRedirect() {
  const status = useAuth((s) => s.status)
  const user = useAuth((s) => s.user)
  if (status === 'booting') return <Booting />
  if (status === 'anon') return <Navigate to="/bem-vindo" replace />
  return <Navigate to={isOnboarded(user) ? '/hoje' : '/setup'} replace />
}
