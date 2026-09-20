import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Button, Card, Dialog, EmptyState, Spinner } from '@/components/ui'
import { useDayScore } from '@/features/progress/api'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, todayIn } from '@/lib/format'
import { useWakeLock } from '@/lib/wake-lock'
import type { DayWorkout, SessionDetail, SessionExercise } from '@/lib/types'

import {
  useAddSet,
  useDeleteSet,
  useSessionDetail,
  useSetSessionStatus,
  useStartSession,
  useUpdateSet,
  useWorkout,
  useWorkoutsDay,
} from './api'
import { ExerciseIcon } from './ExerciseIcon'
import { describeLastSets, describeWeight, fmtDuration, fmtKg, loadLabel } from './load'
import { RestTimer } from './RestTimer'
import { SetRow } from './SetRow'

/** Tela 21: o treino sendo feito — carga por série, descanso automático e tempo total. */
export function SessionPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)

  const day = useWorkoutsDay(today)
  const score = useDayScore(today)
  const start = useStartSession(today)
  const setStatus = useSetSessionStatus(today)
  const [error, setError] = useState<string | null>(null)
  const [confirmSkip, setConfirmSkip] = useState(false)

  // O treino do dia vem da visão do dia; fora do dia marcado, o plano serve de base — dá
  // para treinar em qualquer dia e a sessão entra como treino extra.
  const planned = day.data?.workouts.find((x) => x.workout_id === id)
  const plan = useWorkout(id)
  const extra: DayWorkout | null =
    !planned && plan.data
      ? {
          workout_id: plan.data.id,
          name: plan.data.name,
          exercises: plan.data.exercises.map((e) => ({ ...e, completed: false })),
          exercises_done: 0,
          session: null,
        }
      : null
  const w = planned ?? extra
  const sessionId = w?.session?.id
  const detail = useSessionDetail(sessionId)

  if (day.isPending || (!planned && plan.isPending)) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-6 text-ink-faint" />
      </div>
    )
  }
  if (!w) {
    return (
      <EmptyState
        className="mt-10"
        title="Treino não encontrado"
        description="Ele pode ter sido apagado."
        action={<Button onClick={() => navigate('/treinos')}>Voltar</Button>}
      />
    )
  }

  const dayClosed = Boolean(score.data && !score.data.is_open && score.data.closed_at)
  const editable = !dayClosed && (detail.data?.editable ?? true)

  return (
    <>
      <Header name={w.name} onBack={() => navigate('/treinos')} />
      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[14px] text-danger">
          {error}
        </p>
      )}
      {!sessionId ? (
        <Warmup
          workout={w}
          extra={Boolean(extra)}
          starting={start.isPending}
          onStart={() => start.mutate(id, { onError: (e) => setError(errorMessage(e)) })}
        />
      ) : !detail.data ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : (
        <Running
          detail={detail.data}
          editable={editable}
          onFinish={(duration) => {
            setStatus.mutate(
              { sessionId: detail.data.id, status: 'completed', duration_seconds: duration },
              { onSuccess: () => navigate('/treinos'), onError: (e) => setError(errorMessage(e)) },
            )
          }}
          onSkip={() => setConfirmSkip(true)}
        />
      )}

      <Dialog
        open={confirmSkip}
        onCancel={() => setConfirmSkip(false)}
        title="Pular este treino?"
        description="Fica registrado como planejado e não feito. O número do dia continua honesto."
        confirmLabel="Pular"
        danger
        onConfirm={() => {
          setConfirmSkip(false)
          if (!sessionId) return
          setStatus.mutate({ sessionId, status: 'skipped' }, { onSuccess: () => navigate('/treinos') })
        }}
      />
    </>
  )
}

/**
 * Antes de começar: o que vem pela frente e um botão grande. Sem isso o usuário entrava num
 * treino "já em andamento" sem ter decidido nada — e o cronômetro corria sozinho.
 */
function Warmup({
  workout,
  extra,
  starting,
  onStart,
}: {
  workout: DayWorkout
  extra: boolean // plano que não é do dia da semana: treino extra
  starting: boolean
  onStart: () => void
}) {
  const reduced = useReducedMotion()
  const totalSets = workout.exercises.reduce((sum, e) => sum + (e.sets ?? 3), 0)

  return (
    <>
      <Card className="mt-4 p-4">
        <p className="text-[12px] tracking-[0.14em] text-ink-faint uppercase">{extra ? 'Treino extra' : 'Hoje'}</p>
        <p className="mt-1 text-[22px] leading-tight font-semibold tracking-[-0.02em]">{workout.name}</p>
        <p className="mt-1 text-[13px] text-ink-muted">
          {workout.exercises.length} exercícios · {totalSets} séries previstas
        </p>
        {extra && (
          <p className="mt-2 text-[12px] text-ink-faint">
            Hoje não é dia deste treino. Fazer assim mesmo conta como treino extra do dia.
          </p>
        )}
      </Card>

      <ul className="mt-3 flex flex-col gap-2">
        {workout.exercises.map((e, i) => (
          <m.li
            key={e.id}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 0.04 * i, duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
          >
            <Card className="flex items-center gap-3 p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/6 text-ink-muted">
                <ExerciseIcon icon={e.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{e.name}</span>
                <span className="block text-[12px] text-ink-faint">
                  {[e.sets ? `${e.sets} séries` : null, e.reps ? `${e.reps} reps` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </Card>
          </m.li>
        ))}
      </ul>

      <m.div
        className="sticky bottom-20 z-10 mt-6"
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduced ? 0 : 0.12, type: 'spring', stiffness: 260, damping: 26 }}
      >
        <Button size="lg" full loading={starting} onClick={onStart}>
          Começar treino
        </Button>
      </m.div>
      <p className="mt-2 text-center text-[12px] text-ink-faint">
        O cronômetro começa agora e o descanso liga sozinho a cada série marcada.
      </p>
    </>
  )
}

function Header({ name, onBack }: { name: string; onBack: () => void }) {
  return (
    <div className="safe-top flex items-center gap-3 pt-2">
      <button type="button" onClick={onBack} aria-label="Voltar" className="-ml-1 p-1 text-ink-muted active:text-ink">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <h1 className="truncate text-[20px] font-semibold tracking-[-0.02em]">{name}</h1>
    </div>
  )
}

function Running({
  detail,
  editable,
  onFinish,
  onSkip,
}: {
  detail: SessionDetail
  editable: boolean
  onFinish: (duration: number) => void
  onSkip: () => void
}) {
  const reduced = useReducedMotion()
  const update = useUpdateSet(detail.id)
  const addSet = useAddSet(detail.id)
  const removeSet = useDeleteSet(detail.id)
  const [rest, setRest] = useState<{ seconds: number; label: string } | null>(null)

  // Tempo total: conta desde o início da sessão, pelo relógio.
  const startedAt = useMemo(() => (detail.started_at ? new Date(detail.started_at).getTime() : Date.now()), [detail.started_at])
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startedAt) / 1000))
  const running = detail.status === 'in_progress'
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [running, startedAt])

  // Tela acesa enquanto o treino corre: ninguém quer destravar o celular entre séries.
  useWakeLock(running && editable)

  const pct = detail.planned_sets > 0 ? (detail.done_sets / detail.planned_sets) * 100 : 0

  return (
    <>
      <Card className="mt-3 flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-[0.14em] text-ink-faint uppercase">Tempo</p>
          <p className="text-[28px] leading-none font-semibold tabular-nums">{fmtDuration(elapsed)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] tracking-[0.14em] text-ink-faint uppercase">Séries</p>
          <p className="text-[28px] leading-none font-semibold tabular-nums">
            {detail.done_sets}
            <span className="text-[15px] font-normal text-ink-faint">/{detail.planned_sets}</span>
          </p>
        </div>
      </Card>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
        <m.div
          className="h-full rounded-full bg-accent"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 22 }}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {detail.exercises.map((item, i) => (
          <m.div
            key={item.exercise.id}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : Math.min(i, 6) * 0.05, duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
          >
          <ExerciseCard
            item={item}
            editable={editable}
            onSet={(setId, patch) => {
              update.mutate({ setId, ...patch })
              if (patch.done) {
                const seconds = item.exercise.rest_seconds
                if (seconds) setRest({ seconds, label: item.exercise.name })
              }
            }}
            onAdd={() =>
              addSet.mutate({
                exercise_id: item.exercise.id,
                weight: item.sets.at(-1)?.weight ?? null,
                reps: item.sets.at(-1)?.reps ?? null,
              })
            }
            onRemove={(setId) => removeSet.mutate(setId)}
          />
          </m.div>
        ))}
      </div>

      {detail.total_volume > 0 && (
        <p className="mt-4 text-center text-[13px] text-ink-muted">
          Volume de hoje: <span className="font-semibold text-ink tabular-nums">{fmtKg(detail.total_volume)}</span> levantados
        </p>
      )}

      {editable && (
        <div className="mt-6 flex flex-col gap-2">
          <Button size="lg" full onClick={() => onFinish(elapsed)} disabled={detail.done_sets === 0}>
            {detail.status === 'completed' ? 'Treino concluído' : 'Concluir treino'}
          </Button>
          <Button size="lg" full variant="ghost" onClick={onSkip}>
            Pular hoje
          </Button>
        </div>
      )}
      {!editable && (
        <p className="mt-6 text-center text-[13px] text-ink-faint">Este dia já foi fechado. O registro está guardado como está.</p>
      )}

      <RestTimer
        seconds={rest?.seconds ?? null}
        label={rest?.label}
        onDone={() => setRest(null)}
        onSkip={() => setRest(null)}
        onAdd={(extra) => setRest((r) => (r ? { ...r, seconds: r.seconds + extra } : r))}
      />
    </>
  )
}

function ExerciseCard({
  item,
  editable,
  onSet,
  onAdd,
  onRemove,
}: {
  item: SessionExercise
  editable: boolean
  onSet: (setId: string, patch: { weight?: number; reps?: number; done?: boolean }) => void
  onAdd: () => void
  onRemove: (setId: string) => void
}) {
  const { exercise, sets, progress } = item
  const done = sets.filter((s) => s.done).length
  const complete = done > 0 && done === sets.length

  return (
    <Card className={cn('p-3.5 transition-colors', complete && 'border-accent/30')}>
      <div className="flex items-start gap-3">
        <m.span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full transition-colors',
            complete ? 'bg-accent text-on-accent' : 'bg-white/6 text-ink-muted',
          )}
          animate={complete ? { scale: [1, 1.14, 1] } : { scale: 1 }}
          transition={{ duration: 0.36, ease: 'easeOut' }}
        >
          <ExerciseIcon icon={exercise.icon} />
        </m.span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <Link to={`/treinos/exercicio/${exercise.id}`} className="truncate text-[16px] font-semibold">
              {exercise.name}
            </Link>
            <span className="shrink-0 text-[12px] text-ink-faint tabular-nums">
              {done}/{sets.length}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-ink-faint">
            {[exercise.reps ? `alvo ${exercise.reps} reps` : null, loadLabel(exercise.load_mode)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <PreviousLine item={item} />

      <div className="mt-2.5 flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {sets.map((s) => (
            <SetRow
              key={s.id}
              set={s}
              exercise={exercise}
              editable={editable}
              onChange={(patch) => onSet(s.id, patch)}
              onRemove={sets.length > 1 ? () => onRemove(s.id) : undefined}
            />
          ))}
        </AnimatePresence>
      </div>

      {editable && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 w-full rounded-md border border-dashed border-line-strong py-2 text-[13px] font-medium text-ink-muted active:bg-surface"
        >
          + série
        </button>
      )}

      {progress.best_weight !== null && (
        <p className="mt-2 text-[11px] text-ink-faint">Recorde: {describeWeight(exercise, progress.best_weight)}</p>
      )}
    </Card>
  )
}

/** A linha que faz o trabalho de motivar: o que você fez da última vez e o convite a subir. */
function PreviousLine({ item }: { item: SessionExercise }) {
  const { exercise, progress } = item
  if (progress.last_sets.length === 0) {
    return (
      <p className="mt-2 rounded-md bg-surface px-2.5 py-1.5 text-[12px] text-ink-faint">
        Primeira vez com este exercício. O peso de hoje vira a sua referência.
      </p>
    )
  }
  return (
    <div
      className={cn(
        'mt-2 rounded-md px-2.5 py-1.5 text-[12px]',
        progress.should_increase ? 'bg-accent-soft text-accent' : 'bg-surface text-ink-muted',
      )}
    >
      <span className="font-medium">Última vez: </span>
      {describeLastSets(progress.last_sets)}
      {progress.should_increase && progress.suggested_weight !== null && (
        <span className="mt-0.5 block font-semibold">
          Fechou todas. Hoje sobe para {describeWeight(exercise, progress.suggested_weight)}.
        </span>
      )}
    </div>
  )
}
