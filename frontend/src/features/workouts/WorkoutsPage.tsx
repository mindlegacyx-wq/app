import { useState } from 'react'
import { m } from 'motion/react'
import { Link } from 'react-router'

import { TopBar } from '@/app/shell/TopBar'
import { Button, Card, EmptyState, Fab, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, describeDays, pluralize, todayIn } from '@/lib/format'
import type { DayWorkout, TrainingGoal, Workout } from '@/lib/types'

import { BodyWeightCard } from './BodyWeightCard'
import { WorkoutSheet } from './WorkoutSheet'
import { useExerciseLibrary, useWorkouts, useWorkoutsDay } from './api'

/** Tela 19: planos com dias da semana; treino de hoje em destaque; atalho para o histórico. */
export function WorkoutsPage() {
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)
  const workouts = useWorkouts()
  const day = useWorkoutsDay(today)
  const library = useExerciseLibrary()
  const [creating, setCreating] = useState(false)
  const goals = library.data?.goals ?? []

  return (
    <>
      <TopBar title="Treinos" />

      {workouts.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : workouts.isError ? (
        <EmptyState className="mt-6" title="Não foi possível carregar" description={errorMessage(workouts.error)} />
      ) : workouts.data.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="Nenhum plano de treino"
          description="Monte um plano por tipo de treino (A, B, pernas, corrida) e marque os dias da semana."
          action={<Button onClick={() => setCreating(true)}>Criar o primeiro treino</Button>}
        />
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <BodyWeightCard />
          {day.data && day.data.workouts.length > 0 ? (
            <>
              <h2 className="px-0.5 text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Hoje</h2>
              {day.data.workouts.map((w) => (
                <TodayCard key={w.workout_id} w={w} />
              ))}
              <h2 className="mt-3 px-0.5 text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Todos os planos</h2>
            </>
          ) : (
            <p className="px-0.5 text-[13px] text-ink-faint">
              Nenhum treino marcado para hoje. Dá para treinar qualquer plano da lista em “Treinar agora”.
            </p>
          )}
          {workouts.data.map((w, i) => (
            <PlanCard key={w.id} w={w} goals={goals} index={i} />
          ))}
          <Link to="/treinos/historico" className="mt-2 block">
            <Card className="flex items-center justify-between transition-colors hover:bg-elevated">
              <div>
                <p className="text-[15px]">Histórico</p>
                <p className="text-[13px] text-ink-faint">Dias treinados nas últimas semanas</p>
              </div>
              <svg className="size-4 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
            </Card>
          </Link>
        </div>
      )}

      <Fab label="Novo treino" onClick={() => setCreating(true)} />
      <WorkoutSheet open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

/** Treino de hoje: o card já é o botão de começar — é daqui que a sessão sai. */
function TodayCard({ w }: { w: DayWorkout }) {
  const status = w.session?.status
  const total = w.exercises.length
  const done = w.exercises_done
  const finished = status === 'completed'
  const label = finished ? 'Ver resumo' : status === 'in_progress' ? 'Continuar treino' : status === 'skipped' ? 'Ver treino' : 'Começar treino'

  return (
    <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
      <Link to={`/treinos/${w.workout_id}/sessao`} className="block">
        <Card className={cn('border-accent/30 transition-colors hover:bg-elevated', finished && 'bg-accent-soft')}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[18px] font-semibold tracking-[-0.01em]">{w.name}</h3>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                {finished
                  ? `Concluído · ${done}/${total}`
                  : status === 'skipped'
                    ? 'Pulado hoje'
                    : status === 'in_progress'
                      ? `Em andamento · ${done}/${total}`
                      : pluralize(total, 'exercício', 'exercícios')}
              </p>
            </div>
            {finished && (
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-on-accent" aria-hidden>
                <svg viewBox="0 0 16 16" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
              </span>
            )}
          </div>

          {status === 'in_progress' && total > 0 && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
              <m.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((done / total) * 100)}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          )}

          <span
            className={cn(
              'mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md text-[15px] font-semibold transition-transform active:scale-[0.99]',
              finished || status === 'skipped' ? 'border border-line-strong text-ink-muted' : 'bg-accent text-on-accent',
            )}
          >
            {label}
            {!finished && status !== 'skipped' && (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 5l7 7-7 7" />
              </svg>
            )}
          </span>
        </Card>
      </Link>
    </m.div>
  )
}

function PlanCard({ w, goals, index }: { w: Workout; goals: TrainingGoal[]; index: number }) {
  const goal = goals.find((g) => g.key === w.goal)
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.04, duration: 0.24, ease: 'easeOut' }}
    >
      <Card className={cn('transition-colors', !w.is_active && 'opacity-60')}>
        <Link to={`/treinos/${w.id}`} className="block">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 truncate text-[17px] font-semibold tracking-[-0.01em]">{w.name}</h3>
            <span className="shrink-0 text-[13px] text-ink-muted first-letter:uppercase">{describeDays(w.days_of_week)}</span>
          </div>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            {w.exercises.length === 0 ? 'Sem exercícios ainda' : pluralize(w.exercises.length, 'exercício', 'exercícios')}
            {goal && ` · ${goal.label.toLowerCase()}`}
            {!w.is_active && ' · pausado'}
          </p>
          {w.exercises.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {w.exercises.slice(0, 4).map((e) => (
                <li key={e.id} className="rounded-full border border-line bg-elevated px-2.5 py-1 text-[12px] text-ink-muted">
                  {e.name}
                </li>
              ))}
              {w.exercises.length > 4 && <li className="px-1 py-1 text-[12px] text-ink-faint">+{w.exercises.length - 4}</li>}
            </ul>
          )}
        </Link>
        {w.exercises.length > 0 && (
          <Link
            to={`/treinos/${w.id}/sessao`}
            className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-line-strong text-[14px] font-semibold text-ink-muted transition-colors active:bg-elevated"
          >
            Treinar agora
          </Link>
        )}
      </Card>
    </m.div>
  )
}
