import { Link, useParams } from 'react-router'

import { Card, EmptyState, Ring, Spinner } from '@/components/ui'
import { useGoalsDay } from '@/features/goals/api'
import { useRoutinesDay } from '@/features/routines/api'
import { useTasksDay } from '@/features/tasks/api'
import { useWakeDay } from '@/features/wake/api'
import { useWorkoutsDay } from '@/features/workouts/api'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, relativeDay, shortTime, timeIn, todayIn } from '@/lib/format'

import { useDayScore } from './api'

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Tela 24: fotografia de um dia — o que foi planejado e o que foi cumprido, por área. */
export function DayDetailPage() {
  const { date = '' } = useParams()
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)
  const valid = YMD.test(date) && date <= today

  const score = useDayScore(date)
  const wake = useWakeDay(date, { enabled: valid })
  const routines = useRoutinesDay(date)
  const tasks = useTasksDay(date)
  const goals = useGoalsDay(date)
  const workouts = useWorkoutsDay(date)

  if (!valid) {
    return (
      <div className="safe-top pt-2">
        <Header title="Dia" />
        <EmptyState className="mt-6" title="Data inválida" action={<Link to="/evolucao" className="text-accent">Voltar</Link>} />
      </div>
    )
  }
  if (score.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6 text-ink-faint" />
      </div>
    )
  }
  if (score.isError) {
    return (
      <div className="safe-top pt-2">
        <Header title="Dia" />
        <Card className="mt-6 text-[14px] text-ink-muted">{errorMessage(score.error)}</Card>
      </div>
    )
  }

  const d = score.data
  const label = relativeDay(date, today)
  const longLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  const state = d.is_open ? 'Em andamento' : d.finalized ? 'Finalizado' : d.closed_by === 'user' ? 'Fechado por você' : 'Fechado'

  return (
    <div className="safe-top pt-2 pb-10">
      <Header title={label.charAt(0).toUpperCase() + label.slice(1)} />

      <Card className="mt-3 flex items-center gap-5">
        <Ring value={d.pct} size={104} stroke={10} muted={d.planned === 0}>
          <span className="tabular text-[26px] leading-none font-semibold tracking-[-0.03em]">{d.pct}%</span>
        </Ring>
        <div className="min-w-0">
          <p className="text-[13px] text-ink-muted first-letter:uppercase">{longLabel}</p>
          <p className="mt-1 text-[18px] leading-tight font-semibold tracking-[-0.02em]">
            {d.planned === 0 ? 'Nada planejado' : d.hit_target ? 'Dia cumprido' : 'Meta não atingida'}
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">
            {d.completed} de {d.planned} · meta {d.target}% · {state}
          </p>
          <p className="mt-1 text-[13px] text-ink-faint">
            Sequência naquele dia: <span className="tabular font-semibold text-ink-muted">{d.streak}</span>
          </p>
        </div>
      </Card>

      <Section title="Acordar" planned={d.breakdown.wake.planned} completed={d.breakdown.wake.completed}>
        {wake.data ? (
          wake.data.confirmed_at ? (
            <Row done label={`Levantou às ${timeIn(wake.data.confirmed_at, user.timezone)}`} meta={wake.data.status === 'manual' ? 'manual' : wake.data.snooze_count > 0 ? `${wake.data.snooze_count} soneca${wake.data.snooze_count > 1 ? 's' : ''}` : undefined} />
          ) : d.breakdown.wake.completed > 0 ? (
            <Row done label="Levantou" meta="registro consolidado" />
          ) : d.breakdown.wake.planned > 0 ? (
            <Row done={false} label="Não confirmou que levantou" meta={wake.data.scheduled_time ? `horário ${shortTime(wake.data.scheduled_time)}` : undefined} />
          ) : (
            <Empty planned={d.breakdown.wake.planned} completed={d.breakdown.wake.completed}>Sem horário de acordar.</Empty>
          )
        ) : (
          <Loading />
        )}
      </Section>

      <Section title="Rotinas" planned={d.breakdown.routines.planned} completed={d.breakdown.routines.completed}>
        {routines.data ? (
          routines.data.routines.length === 0 || routines.data.routines.every((r) => r.items.length === 0) ? (
            <Empty planned={d.breakdown.routines.planned} completed={d.breakdown.routines.completed}>Nenhuma rotina com itens neste dia.</Empty>
          ) : (
            routines.data.routines
              .filter((r) => r.items.length > 0)
              .map((r) => (
                <div key={r.id} className="not-first:mt-3">
                  <p className="mb-1 text-[12px] font-semibold text-ink-faint">{r.name}</p>
                  {r.items.map((i) => (
                    <Row key={i.id} done={i.completed_at !== null} label={i.title} meta={i.completed_at ? timeIn(i.completed_at, user.timezone) : undefined} />
                  ))}
                </div>
              ))
          )
        ) : (
          <Loading />
        )}
      </Section>

      <Section title="Tarefas" planned={d.breakdown.tasks.planned} completed={d.breakdown.tasks.completed}>
        {tasks.data ? (
          tasks.data.tasks.length === 0 ? (
            <Empty planned={d.breakdown.tasks.planned} completed={d.breakdown.tasks.completed}>Nenhuma tarefa neste dia.</Empty>
          ) : (
            tasks.data.tasks.map((t) => <Row key={t.id} done={t.status === 'done'} label={t.title} meta={t.status === 'cancelled' ? 'cancelada' : t.completed_at ? timeIn(t.completed_at, user.timezone) : undefined} muted={t.status === 'cancelled'} />)
          )
        ) : (
          <Loading />
        )}
      </Section>

      <Section title="Treino" planned={d.breakdown.workout.planned} completed={d.breakdown.workout.completed}>
        {workouts.data ? (
          workouts.data.workouts.length === 0 ? (
            <Empty planned={d.breakdown.workout.planned} completed={d.breakdown.workout.completed}>Nenhum treino neste dia.</Empty>
          ) : (
            workouts.data.workouts.map((w) => (
              <Row
                key={w.workout_id}
                done={w.session?.status === 'completed'}
                label={w.name}
                meta={w.session?.status === 'skipped' ? 'pulado' : `${w.exercises_done}/${w.exercises.length} exercícios`}
              />
            ))
          )
        ) : (
          <Loading />
        )}
      </Section>

      <Section title="Metas" planned={d.breakdown.goals.planned} completed={d.breakdown.goals.completed}>
        {goals.data ? (
          goals.data.actions.length === 0 ? (
            <Empty planned={d.breakdown.goals.planned} completed={d.breakdown.goals.completed}>Nenhuma ação de meta com data neste dia.</Empty>
          ) : (
            goals.data.actions.map((a) => <Row key={a.id} done={a.is_done} label={a.title} meta={a.goal_title} />)
          )
        ) : (
          <Loading />
        )}
      </Section>
    </div>
  )
}

function Header({ title }: { title: string }) {
  return (
    <header className="flex h-12 items-center gap-3">
      <Link to="/evolucao" aria-label="Voltar" className="-ml-2 flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <h1 className="truncate text-[20px] font-semibold tracking-[-0.02em]">{title}</h1>
    </header>
  )
}

function Section({ title, planned, completed, children }: { title: string; planned: number; completed: number; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between px-0.5">
        <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">{title}</h2>
        <span className={cn('tabular text-[12px]', planned === 0 ? 'text-ink-faint' : completed === planned ? 'text-accent' : 'text-ink-muted')}>
          {planned === 0 ? '—' : `${completed}/${planned}`}
        </span>
      </div>
      <Card>{children}</Card>
    </section>
  )
}

function Row({ done, label, meta, muted }: { done: boolean; label: string; meta?: string; muted?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 py-1.5', muted && 'opacity-60')}>
      <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border', done ? 'border-accent bg-accent text-on-accent' : 'border-line-strong text-transparent')}>
        <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-[15px]', !done && !muted && 'text-ink-muted')}>{label}</span>
      {meta && <span className="tabular shrink-0 text-[12px] text-ink-faint">{meta}</span>}
    </div>
  )
}

/** Sem itens ao vivo. Se o dia fechado registrou algo (item excluído depois), mostra o consolidado. */
function Empty({ planned, completed, children }: { planned: number; completed: number; children: React.ReactNode }) {
  if (planned > 0) {
    return (
      <p className="text-[14px] text-ink-muted">
        Registro consolidado do dia: <span className="tabular font-semibold text-ink">{completed} de {planned}</span>
        <span className="block text-[12px] text-ink-faint">Os itens originais não existem mais.</span>
      </p>
    )
  }
  return <p className="text-[14px] text-ink-faint">{children}</p>
}

function Loading() {
  return (
    <div className="flex h-8 items-center">
      <Spinner className="size-4 text-ink-faint" />
    </div>
  )
}
