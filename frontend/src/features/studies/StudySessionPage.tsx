import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Button, Card, Checkbox, Dialog, EmptyState, Ring, Spinner } from '@/components/ui'
import { useDayScore } from '@/features/progress/api'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, relativeDay, shortTime, todayIn } from '@/lib/format'
import { useWakeLock } from '@/lib/wake-lock'

import { useExam, useStartSession, useStudySession, useUpdateSession, useUpdateTopic } from './api'
import { examKindLabel, fmtClock, fmtFocus, fmtMinutes } from './shared'

const YMD = /^\d{4}-\d{2}-\d{2}$/

interface TimerState {
  base: number // segundos acumulados enquanto pausado
  runningSince: number | null // epoch ms quando está rodando
}

function timerKey(examId: string, date: string) {
  return `disciplina.study-timer.${examId}.${date}`
}

function loadTimer(key: string): TimerState {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as TimerState
  } catch {
    /* sem storage */
  }
  return { base: 0, runningSince: null }
}

function saveTimer(key: string, t: TimerState | null) {
  try {
    if (t) localStorage.setItem(key, JSON.stringify(t))
    else localStorage.removeItem(key)
  } catch {
    /* sem storage */
  }
}

function elapsedOf(t: TimerState, now = Date.now()): number {
  return t.base + (t.runningSince ? (now - t.runningSince) / 1000 : 0)
}

/** Sino curto ao bater os minutos planejados (Web Audio, sem arquivo). */
function chime() {
  try {
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4)
    for (const [f, at] of [
      [880, 0],
      [1320, 0.18],
    ] as const) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(gain)
      o.start(ctx.currentTime + at)
      o.stop(ctx.currentTime + 1.5)
    }
    window.setTimeout(() => void ctx.close(), 1800)
  } catch {
    /* sem áudio */
  }
}

/** Tela 35: cronômetro de foco de uma sessão de estudo, com os conteúdos da prova à mão. */
export function StudySessionPage() {
  const { id: examId = '', date = '' } = useParams()
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)
  const navigate = useNavigate()
  const valid = YMD.test(date) && date <= today

  const session = useStudySession(examId, date)
  const exam = useExam(examId)
  const score = useDayScore(date)
  const start = useStartSession()
  const update = useUpdateSession()
  const updateTopic = useUpdateTopic()

  const key = timerKey(examId, date)
  const [timer, setTimer] = useState<TimerState>(() => loadTimer(key))
  const [now, setNow] = useState(() => Date.now())
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chimed = useRef(false)

  const running = timer.runningSince !== null
  useWakeLock(running)

  // Relógio: 1 tick por segundo enquanto roda (e um ao voltar para a aba).
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [running])

  const s = session.data
  const serverSeconds = s?.focused_seconds ?? 0
  const elapsed = Math.max(serverSeconds, Math.floor(elapsedOf(timer, now)))
  const plannedSeconds = (s?.planned_minutes ?? 30) * 60
  const reached = elapsed >= plannedSeconds
  const done = s?.status === 'completed'
  const editable = score.data ? score.data.is_open : date === today

  useEffect(() => {
    if (reached && running && !chimed.current) {
      chimed.current = true
      chime()
      if ('vibrate' in navigator) navigator.vibrate?.([80, 60, 80])
    }
  }, [reached, running])

  const persist = useCallback(
    (next: TimerState | null) => {
      saveTimer(key, next)
      if (next) setTimer(next)
    },
    [key],
  )

  async function begin() {
    setError(null)
    try {
      if (!s?.id || s.status !== 'in_progress') await start.mutateAsync({ examId, date })
      persist({ base: Math.max(timer.base, serverSeconds), runningSince: Date.now() })
      setNow(Date.now())
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  function pause() {
    const total = Math.floor(elapsedOf(timer))
    persist({ base: total, runningSince: null })
    if (s?.id) update.mutate({ id: s.id, focused_seconds: total }, { onError: (err) => setError(errorMessage(err)) })
  }

  async function finish() {
    setError(null)
    const total = Math.max(serverSeconds, Math.floor(elapsedOf(timer)))
    try {
      let sid = s?.id ?? null
      if (!sid) sid = (await start.mutateAsync({ examId, date })).id
      await update.mutateAsync({ id: sid!, status: 'completed', focused_seconds: total })
      saveTimer(key, null)
      setTimer({ base: total, runningSince: null })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function skip() {
    setError(null)
    try {
      let sid = s?.id ?? null
      if (!sid) sid = (await start.mutateAsync({ examId, date })).id
      await update.mutateAsync({ id: sid!, status: 'skipped', focused_seconds: Math.floor(elapsedOf(timer)) })
      saveTimer(key, null)
      setConfirmSkip(false)
      navigate(-1)
    } catch (err) {
      setConfirmSkip(false)
      setError(errorMessage(err))
    }
  }

  async function reopen() {
    if (!s?.id) return
    setError(null)
    try {
      await update.mutateAsync({ id: s.id, status: 'in_progress' })
      persist({ base: serverSeconds, runningSince: null })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (!valid) {
    return (
      <div className="safe-top pt-2">
        <Header examId={examId} title="Sessão" />
        <EmptyState
          className="mt-6"
          title="Data inválida"
          action={
            <Link to="/estudos" className="text-accent">
              Voltar
            </Link>
          }
        />
      </div>
    )
  }
  if (session.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6 text-ink-faint" />
      </div>
    )
  }
  if (session.isError || !s) {
    return (
      <div className="safe-top pt-2">
        <Header examId={examId} title="Sessão" />
        <EmptyState
          className="mt-6"
          title="Não foi possível carregar"
          description={session.error ? errorMessage(session.error) : undefined}
        />
      </div>
    )
  }

  const topics = exam.data?.topics ?? []
  const dayLabel = relativeDay(date, today)

  return (
    <div className="safe-top pt-2 pb-10">
      <Header examId={examId} title={`Sessão de ${dayLabel}`} />

      <Card className="mt-3 flex flex-col items-center px-5 py-7 text-center">
        <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
          {examKindLabel[s.exam_kind]}
          {s.subject_name && ` · ${s.subject_name}`}
        </p>
        <h2 className="mt-1 text-[20px] leading-tight font-semibold tracking-[-0.02em]">{s.exam_title}</h2>

        <div className="mt-6">
          <Ring
            value={Math.min(100, Math.round((elapsed * 100) / plannedSeconds))}
            size={196}
            stroke={12}
            muted={elapsed === 0 && !running}
          >
            <span className={cn('tabular text-[44px] leading-none font-semibold tracking-[-0.03em]', reached && 'text-accent')}>
              {fmtClock(elapsed)}
            </span>
            <span className="mt-2 text-[12px] text-ink-faint">de {fmtMinutes(s.planned_minutes)}</span>
          </Ring>
        </div>

        <p className={cn('mt-5 text-[14px]', reached ? 'font-semibold text-accent' : 'text-ink-muted')}>
          {done
            ? `Concluída · ${fmtFocus(elapsed)} de foco`
            : reached
              ? 'Meta de hoje batida. Pode concluir ou seguir.'
              : running
                ? 'Em foco. Celular de lado.'
                : s.status === 'skipped'
                  ? 'Você pulou hoje. Dá para retomar.'
                  : s.suggested_start
                    ? `Sugestão: ${shortTime(s.suggested_start)}–${shortTime(s.suggested_end)}`
                    : 'Quando estiver pronto, começa.'}
        </p>

        {error && <p className="mt-3 text-[14px] text-danger">{error}</p>}

        {!editable ? (
          <p className="mt-5 text-[13px] text-ink-faint">Dia fechado: só leitura.</p>
        ) : done ? (
          <Button variant="ghost" className="mt-5" onClick={() => void reopen()} loading={update.isPending}>
            Reabrir sessão
          </Button>
        ) : (
          <div className="mt-6 flex w-full flex-col gap-2">
            {running ? (
              <Button size="lg" full variant="secondary" onClick={pause}>
                Pausar
              </Button>
            ) : (
              <Button size="lg" full variant={reached ? 'secondary' : 'primary'} onClick={() => void begin()} loading={start.isPending}>
                {elapsed > 0 || s.status === 'in_progress' ? 'Retomar' : 'Começar'}
              </Button>
            )}
            <Button
              size="lg"
              full
              variant={reached ? 'primary' : 'secondary'}
              onClick={() => void finish()}
              loading={update.isPending}
              disabled={elapsed === 0 && !reached}
            >
              Concluir sessão
            </Button>
            {!running && s.status !== 'skipped' && (
              <Button variant="ghost" full onClick={() => setConfirmSkip(true)}>
                Pular hoje
              </Button>
            )}
          </div>
        )}
      </Card>

      {topics.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex items-baseline justify-between px-0.5">
            <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Conteúdos</h2>
            <span className="tabular text-[12px] text-ink-muted">
              {topics.filter((t) => t.is_done).length}/{topics.length}
            </span>
          </div>
          <Card padded={false} className="divide-y divide-line overflow-hidden">
            {topics.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 select-none">
                <Checkbox
                  label={t.title}
                  checked={t.is_done}
                  disabled={updateTopic.isPending}
                  onChange={(v) => updateTopic.mutate({ examId, id: t.id, is_done: v })}
                />
                <span className={cn('min-w-0 flex-1 text-[15px]', t.is_done && 'text-ink-faint line-through')}>{t.title}</span>
              </label>
            ))}
          </Card>
        </section>
      )}

      <Dialog
        open={confirmSkip}
        title="Pular a sessão de hoje?"
        description="Ela continua contando como planejada e não feita no percentual do dia. Amanhã a prova cobra de novo."
        confirmLabel="Pular"
        danger
        loading={update.isPending || start.isPending}
        onCancel={() => setConfirmSkip(false)}
        onConfirm={() => void skip()}
      />
    </div>
  )
}

function Header({ examId, title }: { examId: string; title: string }) {
  return (
    <header className="flex h-12 items-center gap-3">
      <Link
        to={`/estudos/${examId}`}
        aria-label="Voltar"
        className="-ml-2 flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink"
      >
        <svg
          className="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold tracking-[-0.02em] first-letter:uppercase">{title}</h1>
    </header>
  )
}
