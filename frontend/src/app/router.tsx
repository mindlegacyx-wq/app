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
const TrashPage = lazy(() => import('@/features/settings/TrashPage').then((m) => ({ default: m.TrashPage })))
const RoutinesPage = lazy(() => import('@/features/routines/RoutinesPage').then((m) => ({ default: m.RoutinesPage })))
const RoutineEditorPage = lazy(() =>
  import('@/features/routines/RoutineEditorPage').then((m) => ({ default: m.RoutineEditorPage })),
)
const AgendaPage = lazy(() => import('@/features/schedule/AgendaPage').then((m) => ({ default: m.AgendaPage })))
const SubjectsPage = lazy(() => import('@/features/schedule/SubjectsPage').then((m) => ({ default: m.SubjectsPage })))
const GoalsPage = lazy(() => import('@/features/goals/GoalsPage').then((m) => ({ default: m.GoalsPage })))
const GoalDetailPage = lazy(() => import('@/features/goals/GoalDetailPage').then((m) => ({ default: m.GoalDetailPage })))
const WorkoutsPage = lazy(() => import('@/features/workouts/WorkoutsPage').then((m) => ({ default: m.WorkoutsPage })))
const WorkoutEditorPage = lazy(() =>
  import('@/features/workouts/WorkoutEditorPage').then((m) => ({ default: m.WorkoutEditorPage })),
)
const SessionPage = lazy(() => import('@/features/workouts/SessionPage').then((m) => ({ default: m.SessionPage })))
const HistoryPage = lazy(() => import('@/features/workouts/HistoryPage').then((m) => ({ default: m.HistoryPage })))
const AlarmsPage = lazy(() => import('@/features/alarms/AlarmsPage').then((m) => ({ default: m.AlarmsPage })))
const WakeHistoryPage = lazy(() =>
  import('@/features/alarms/WakeHistoryPage').then((m) => ({ default: m.WakeHistoryPage })),
)
const AlarmScreen = lazy(() => import('@/features/alarms/AlarmScreen').then((m) => ({ default: m.AlarmScreen })))
const CloseDayPage = lazy(() => import('@/features/progress/CloseDayPage').then((m) => ({ default: m.CloseDayPage })))
const EvolutionPage = lazy(() => import('@/features/progress/EvolutionPage').then((m) => ({ default: m.EvolutionPage })))
const DayDetailPage = lazy(() => import('@/features/progress/DayDetailPage').then((m) => ({ default: m.DayDetailPage })))

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
      // Tela cheia, sem layout: o fundo do alarme ocupa a janela inteira.
      { path: '/alarme', element: <Lazy><AlarmScreen /></Lazy> },
      {
        element: <PlainLayout />,
        children: [
          { path: '/setup', element: <Lazy><SetupPage /></Lazy> },
          { path: '/instalar', element: <Lazy><InstallPage /></Lazy> },
          { path: '/configuracoes', element: <Lazy><SettingsPage /></Lazy> },
          { path: '/configuracoes/lixeira', element: <Lazy><TrashPage /></Lazy> },
          { path: '/rotina/:id', element: <Lazy><RoutineEditorPage /></Lazy> },
          { path: '/agenda', element: <Lazy><AgendaPage /></Lazy> },
          { path: '/agenda/materias', element: <Lazy><SubjectsPage /></Lazy> },
          { path: '/despertador', element: <Lazy><AlarmsPage /></Lazy> },
          { path: '/despertador/historico', element: <Lazy><WakeHistoryPage /></Lazy> },
          { path: '/hoje/fechar', element: <Lazy><CloseDayPage /></Lazy> },
          { path: '/evolucao/:date', element: <Lazy><DayDetailPage /></Lazy> },
          { path: '/metas/:id', element: <Lazy><GoalDetailPage /></Lazy> },
          { path: '/treinos/historico', element: <Lazy><HistoryPage /></Lazy> },
          { path: '/treinos/:id', element: <Lazy><WorkoutEditorPage /></Lazy> },
          { path: '/treinos/:id/sessao', element: <Lazy><SessionPage /></Lazy> },
        ],
      },
      {
        element: <AppShell />,
        children: [
          { path: '/hoje', element: <TodayPage /> },
          { path: '/rotina', element: <Lazy><RoutinesPage /></Lazy> },
          { path: '/metas', element: <Lazy><GoalsPage /></Lazy> },
          { path: '/treinos', element: <Lazy><WorkoutsPage /></Lazy> },
          { path: '/evolucao', element: <Lazy><EvolutionPage /></Lazy> },
        ],
      },
    ],
  },
  { path: '*', element: <RootRedirect /> },
])
