import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router'

import { Spinner } from '@/components/ui'
import { TodayPage } from '@/features/today/TodayPage'

import { RedirectIfAuthed, RequireAuth, RootRedirect } from './guards'
import { AppShell, PlainLayout } from './shell/AppShell'

// Hoje fica no bundle principal (é a tela de todo dia). O resto carrega sob demanda.
const WelcomePage = lazy(() => import('@/features/onboarding/WelcomePage').then((m) => ({ default: m.WelcomePage })))
const AuthPage = lazy(() => import('@/features/auth/AuthPage').then((m) => ({ default: m.AuthPage })))
const SetupPage = lazy(() => import('@/features/onboarding/SetupPage').then((m) => ({ default: m.SetupPage })))
const InstallPage = lazy(() => import('@/features/onboarding/InstallPage').then((m) => ({ default: m.InstallPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const RoutinesPage = lazy(() => import('@/features/routines/RoutinesPage').then((m) => ({ default: m.RoutinesPage })))
const RoutineEditorPage = lazy(() =>
  import('@/features/routines/RoutineEditorPage').then((m) => ({ default: m.RoutineEditorPage })),
)
const CloseDayPage = lazy(() => import('@/features/progress/CloseDayPage').then((m) => ({ default: m.CloseDayPage })))
const ComingSoonPage = lazy(() =>
  import('@/features/placeholders/ComingSoonPage').then((m) => ({ default: m.ComingSoonPage })),
)

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  {
    element: <RedirectIfAuthed />,
    children: [
      {
        element: <PlainLayout />,
        children: [
          { path: '/bem-vindo', element: <Lazy><WelcomePage /></Lazy> },
          { path: '/entrar', element: <Lazy><AuthPage mode="login" /></Lazy> },
          { path: '/criar-conta', element: <Lazy><AuthPage mode="register" /></Lazy> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <PlainLayout />,
        children: [
          { path: '/setup', element: <Lazy><SetupPage /></Lazy> },
          { path: '/instalar', element: <Lazy><InstallPage /></Lazy> },
          { path: '/configuracoes', element: <Lazy><SettingsPage /></Lazy> },
          { path: '/rotina/:id', element: <Lazy><RoutineEditorPage /></Lazy> },
          { path: '/hoje/fechar', element: <Lazy><CloseDayPage /></Lazy> },
        ],
      },
      {
        element: <AppShell />,
        children: [
          { path: '/hoje', element: <TodayPage /> },
          { path: '/rotina', element: <Lazy><RoutinesPage /></Lazy> },
          { path: '/metas', element: <Lazy><ComingSoonPage title="Metas" phase={4} /></Lazy> },
          { path: '/treinos', element: <Lazy><ComingSoonPage title="Treinos" phase={5} /></Lazy> },
          { path: '/evolucao', element: <Lazy><ComingSoonPage title="Evolução" phase={3} /></Lazy> },
        ],
      },
    ],
  },
  { path: '*', element: <RootRedirect /> },
])
