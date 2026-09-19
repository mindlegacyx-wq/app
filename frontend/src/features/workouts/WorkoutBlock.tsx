import { Link } from 'react-router'

import { Card, Section, Spinner } from '@/components/ui'
import { useScheduleDay } from '@/features/schedule/api'
import { errorMessage } from '@/lib/api'
import { cn, pluralize, shortTime } from '@/lib/format'

import { useWorkouts, useWorkoutsDay } from './api'

/** Bloco "Treino de hoje" da tela Hoje: um card por plano do dia, com estado da sessão. */
export function WorkoutBlock({ date }: { date: string }) {
  const day = useWorkoutsDay(date)
  const plans = useWorkouts()
  const agenda = useScheduleDay(date)
  const items = day.data?.workouts ?? []
  // Horário do treino vem da agenda (bloco do tipo treino ligado ao plano).
  const startOf = (workoutId: string) =>
    agenda.data?.blocks.find((b) => b.is_active && b.kind === 'workout' && b.workout_id === workoutId)?.start_time
  const hasPlans = (plans.data?.length ?? 0) > 0

  const aside = day.data && day.data.planned > 0 && (
    <span className={cn('tabular', day.data.completed === day.data.planned && 'text-accent')}>
      {day.data.completed}/{day.data.planned}
    </span>
  )

  return (
    <Section title="Treino de hoje" aside={aside}>
      {day.isPending ? (
        <Card className="flex h-14 items-center justify-center">
          <Spinner className="size-5 text-ink-faint" />
        </Card>
      ) : day.isError ? (
        <Card className="text-[14px] text-ink-muted">{errorMessage(day.error)}</Card>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3.5">
          <p className="text-[14px] text-ink-muted">{hasPlans ? 'Sem treino planejado para hoje.' : 'Crie um plano de treino.'}</p>
          <Link to="/treinos" className="shrink-0 text-[13px] font-semibold text-accent">
            {hasPlans ? 'Treinos' : 'Criar'}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((w) => {
            const status = w.session?.status
            const total = w.exercises.length
            const at = startOf(w.workout_id)
            return (
              <Link key={w.workout_id} to={`/treinos/${w.workout_id}/sessao`} className="block">
                <Card className={cn('flex items-center gap-3 transition-colors hover:bg-elevated', status === 'completed' && 'border-accent/30')}>
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full border-2',
                      status === 'completed' ? 'border-accent bg-accent text-on-accent' : 'border-line-strong text-ink-faint',
                    )}
                    aria-hidden
                  >
                    {status === 'completed' ? (
                      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
                    ) : status === 'skipped' ? (
                      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[15px]', status === 'completed' && 'text-ink-faint line-through')}>{w.name}</span>
                    <span className="block text-[12px] text-ink-faint">
                      {at && status !== 'completed' && status !== 'skipped' && `${shortTime(at)} · `}
                      {status === 'completed'
                        ? `Concluído · ${w.exercises_done}/${total}`
                        : status === 'skipped'
                          ? 'Pulado hoje'
                          : status === 'in_progress'
                            ? `Em andamento · ${w.exercises_done}/${total}`
                            : pluralize(total, 'exercício', 'exercícios')}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-accent">
                    {status === 'completed' ? 'Ver' : status === 'in_progress' ? 'Continuar' : status === 'skipped' ? 'Ver' : 'Iniciar'}
                  </span>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </Section>
  )
}
