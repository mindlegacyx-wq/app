import { useState } from 'react'
import { Link } from 'react-router'

import { TopBar } from '@/app/shell/TopBar'
import { Button, Card, EmptyState, Fab, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, describeDays, pluralize, todayIn } from '@/lib/format'
import type { DayWorkout, Workout } from '@/lib/types'

import { BodyWeightCard } from './BodyWeightCard'
import { WorkoutSheet } from './WorkoutSheet'
import { useWorkouts, useWorkoutsDay } from './api'

/** Tela 19: planos com dias da semana; treino de hoje em destaque; atalho para o histórico. */
export function WorkoutsPage() {
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)
  const workouts = useWorkouts()
  const day = useWorkoutsDay(today)
  const [creating, setCreating] = useState(false)

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
          {day.data && day.data.workouts.length > 0 && (
            <>
              <h2 className="px-0.5 text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Hoje</h2>
              {day.data.workouts.map((w) => (
                <TodayCard key={w.workout_id} w={w} />
              ))}
              <h2 className="mt-3 px-0.5 text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Todos os planos</h2>
            </>
          )}
          {workouts.data.map((w) => (
            <PlanCard key={w.id} w={w} />
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

function TodayCard({ w }: { w: DayWorkout }) {
  const status = w.session?.status
  const total = w.exercises.length
  return (
    <Link to={`/treinos/${w.workout_id}/sessao`} className="block">
      <Card className={cn('border-accent/30 transition-colors hover:bg-elevated', status === 'completed' && 'bg-accent-soft')}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[18px] font-semibold tracking-[-0.01em]">{w.name}</h3>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {status === 'completed'
                ? 'Concluído'
                : status === 'skipped'
                  ? 'Pulado hoje'
                  : status === 'in_progress'
                    ? `Em andamento · ${w.exercises_done}/${total}`
                    : `${pluralize(total, 'exercício', 'exercícios')}`}
            </p>
          </div>
          <span className={cn('shrink-0 text-[13px] font-semibold', status === 'completed' ? 'text-accent' : 'text-accent')}>
            {status === 'completed' ? '✓' : status === 'in_progress' ? 'Continuar' : status === 'skipped' ? 'Ver' : 'Iniciar'}
          </span>
        </div>
      </Card>
    </Link>
  )
}

function PlanCard({ w }: { w: Workout }) {
  return (
    <Link to={`/treinos/${w.id}`} className="block">
      <Card className={cn('transition-colors hover:bg-elevated', !w.is_active && 'opacity-60')}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-[17px] font-semibold tracking-[-0.01em]">{w.name}</h3>
          <span className="shrink-0 text-[13px] text-ink-muted first-letter:uppercase">{describeDays(w.days_of_week)}</span>
        </div>
        <p className="mt-1.5 text-[13px] text-ink-muted">
          {w.exercises.length === 0 ? 'Sem exercícios ainda' : pluralize(w.exercises.length, 'exercício', 'exercícios')}
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
      </Card>
    </Link>
  )
}
