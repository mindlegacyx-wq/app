import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Button, Card, Checkbox, Dialog, EmptyState, Spinner } from '@/components/ui'
import { useDayScore } from '@/features/progress/api'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, timeIn, todayIn } from '@/lib/format'

import { useSetSessionStatus, useStartSession, useToggleExercise, useWorkoutsDay } from './api'
import { exerciseMeta } from './shared'

/** Tela 21: sessão de hoje com check por exercício, cronômetro de descanso, concluir / pular. */
export function SessionPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)

  const day = useWorkoutsDay(today)
  const score = useDayScore(today)
  const start = useStartSession(today)
  const toggle = useToggleExercise(today)
  const setStatus = useSetSessionStatus(today)
  const [rest, setRest] = useState<{ total: number; left: number } | null>(null)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const w = day.data?.workouts.find((x) => x.workout_id === id)
  const dayClosed = Boolean(score.data && !score.data.is_open && score.data.closed_at)
  const editable = !dayClosed

  // Cronômetro de descanso: conta até zero e vibra ao terminar.
  useEffect(() => {
    if (!rest || rest.left <= 0) return
    const t = window.setTimeout(() => setRest((r) => (r ? { ...r, left: r.left - 1 } : r)), 1000)
    return () => window.clearTimeout(t)
  }, [rest])
  const vibrated = useRef(false)
  useEffect(() => {
    if (rest && rest.left === 0 && !vibrated.current) {
      vibrated.current = true
      if ('vibrate' in navigator) navigator.vibrate?.([120, 60, 120])
    }
    if (!rest || rest.left > 0) vibrated.current = false
  }, [rest])

  async function ensureSession(): Promise<string | null> {
    if (w?.session) return w.session.id
    try {
      const s = await start.mutateAsync(id)
      return s.id
    } catch (err) {
      setError(errorMessage(err))
      return null
    }
  }

  async function onToggle(exerciseId: string, completed: boolean, restSeconds: number | null) {
    const sessionId = await ensureSession()
    if (!sessionId) return
    toggle.mutate({ sessionId, exerciseId, completed }, { onError: (e) => setError(errorMessage(e)) })
    if (completed && restSeconds) setRest({ total: restSeconds, left: restSeconds })
    if (!completed) setRest(null)
  }

  async function finish(status: 'completed' | 'skipped') {
    const sessionId = await ensureSession()
    if (!sessionId) return
    setRest(null)
    setStatus.mutate({ sessionId, status }, { onError: (e) => setError(errorMessage(e)), onSuccess: () => setConfirmSkip(false) })
  }

  if (day.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6 text-ink-faint" />
      </div>
    )
  }
  if (!w) {
    return (
      <div className="safe-top pt-2">
        <Header title="Sessão" />
        <EmptyState
          className="mt-6"
          title="Este treino não está planejado para hoje"
          description="Sessões só podem ser registradas no dia. Abra o plano para editar os dias da semana."
          action={<Link to={`/treinos/${id}`} className="text-accent">Abrir plano</Link>}
        />
      </div>
    )
  }

  const total = w.exercises.length
  const status = w.session?.status
  const done = status === 'completed'
  const skipped = status === 'skipped'

  return (
    <div className="safe-top flex min-h-dvh flex-col pt-2 pb-28">
      <Header title={w.name} right={<span className="tabular text-[15px] font-semibold text-ink-muted">{w.exercises_done}/{total}</span>} />

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[14px] text-danger">
          {error}
        </p>
      )}

      {(done || skipped) && (
        <Card className={cn('mt-3 flex items-center justify-between', done && 'border-accent/30 bg-accent-soft')}>
          <p className="text-[15px]">
            {done ? (
              <>
                <span className="font-semibold text-accent">Treino concluído</span>
                {w.session?.completed_at && <span className="text-ink-muted"> às {timeIn(w.session.completed_at, user.timezone)}</span>}
              </>
            ) : (
              <span className="text-ink-muted">Você pulou este treino hoje.</span>
            )}
          </p>
          {editable && (
            <Button size="sm" variant="ghost" loading={setStatus.isPending} onClick={() => finish('completed')} className={cn(done && 'hidden')}>
              Retomar
            </Button>
          )}
        </Card>
      )}

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
        <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out-quart', done ? 'bg-accent' : 'bg-ink-muted')} style={{ width: `${total ? (w.exercises_done / total) * 100 : 0}%` }} />
      </div>

      <Card padded={false} className="mt-4 divide-y divide-line overflow-hidden">
        {w.exercises.map((e, i) => {
          const meta = exerciseMeta(e)
          return (
            <label key={e.id} className={cn('flex cursor-pointer items-center gap-3 px-4 py-3.5 select-none', !editable && 'cursor-default')}>
              <span className="tabular w-5 shrink-0 text-[12px] text-ink-faint">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-[16px]', e.completed && 'text-ink-faint line-through')}>{e.name}</span>
                {meta && <span className="tabular mt-0.5 block text-[12px] text-ink-faint">{meta}</span>}
              </span>
              <Checkbox label={e.name} checked={e.completed} disabled={!editable || toggle.isPending} onChange={(v) => onToggle(e.id, v, e.rest_seconds)} />
            </label>
          )
        })}
      </Card>

      {rest && (
        <Card className="mt-4 flex items-center gap-4 border-accent/30">
          <div className="relative size-14 shrink-0">
            <svg viewBox="0 0 56 56" className="-rotate-90">
              <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="5" className="text-white/8" />
              <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" className={cn('transition-[stroke-dashoffset] duration-1000 linear', rest.left === 0 ? 'text-accent' : 'text-ink-muted')} strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - rest.left / rest.total)} />
            </svg>
            <span className="tabular absolute inset-0 flex items-center justify-center text-[15px] font-semibold">{rest.left}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{rest.left === 0 ? 'Descanso encerrado' : 'Descanso'}</p>
            <p className="text-[13px] text-ink-muted">{rest.left === 0 ? 'Próximo exercício.' : `${rest.total}s entre séries`}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setRest(null)}>
            {rest.left === 0 ? 'Ok' : 'Encerrar'}
          </Button>
        </Card>
      )}

      {editable && !done && !skipped && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/85 backdrop-blur-xl">
          <div className="safe-bottom mx-auto flex max-w-lg gap-2 px-5 py-3">
            <Button variant="secondary" className="shrink-0 whitespace-nowrap" onClick={() => setConfirmSkip(true)}>
              Pular treino
            </Button>
            <Button full loading={setStatus.isPending} onClick={() => finish('completed')} variant={w.exercises_done === total ? 'primary' : 'secondary'}>
              Concluir treino
            </Button>
          </div>
        </div>
      )}
      {(done || skipped) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/85 backdrop-blur-xl">
          <div className="safe-bottom mx-auto flex max-w-lg gap-2 px-5 py-3">
            <Button full variant="secondary" onClick={() => navigate('/hoje')}>
              Voltar para Hoje
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={confirmSkip}
        title="Pular o treino de hoje?"
        description="Fica registrado como pulado. Continua contando como planejado e não feito no seu percentual."
        confirmLabel="Pular"
        danger
        loading={setStatus.isPending}
        onCancel={() => setConfirmSkip(false)}
        onConfirm={() => finish('skipped')}
      />
    </div>
  )
}

function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <header className="flex h-12 items-center gap-3">
      <Link to="/hoje" aria-label="Voltar" className="-ml-2 flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold tracking-[-0.02em]">{title}</h1>
      {right}
    </header>
  )
}
