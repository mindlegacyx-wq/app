import { m } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button, HoldButton, Spinner } from '@/components/ui'
import { useConfirmWake, useRingWake, useSnoozeWake, useWakeDay } from '@/features/wake/api'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, longDate, timeIn, todayIn } from '@/lib/format'
import type { AlarmSound, WakeDay } from '@/lib/types'

import { useAlarms } from './api'
import { createAlarmPlayer } from './sounds'

/**
 * Tela 13: alarme tocando, em tela cheia.
 * Som em loop (Web Audio), tela acesa (Wake Lock), segurar 3 s para "Levantei", soneca.
 */
export function AlarmScreen() {
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)
  const day = useWakeDay(today, { refetchInterval: 15_000 })
  const confirm = useConfirmWake(today)
  const snooze = useSnoozeWake()
  const ring = useRingWake()
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clock = useClock()

  const d = day.data
  const ringing = Boolean(d?.ringing)
  // `ringing` já diz se o próximo toque passou (calculado no servidor na hora da leitura).
  const snoozedUntil = d?.status === 'pending' && !d.ringing && d.next_ring_at ? d.next_ring_at : null
  const confirmed = Boolean(d?.confirmed_at)
  const sound = d?.alarm?.sound ?? 'classic'

  useAlarmSound(ringing && !muted && !confirmed, sound)
  useWakeLock(Boolean(d && d.status === 'pending'))

  // Soneca acabou → toca de novo (o job também faz isso; a chamada é idempotente).
  const alarmId = d?.alarm?.id
  const ringRef = useRef(ring)
  useEffect(() => {
    ringRef.current = ring
  })
  useEffect(() => {
    if (!snoozedUntil || !alarmId) return
    const delay = new Date(snoozedUntil).getTime() - Date.now()
    const t = window.setTimeout(() => {
      setMuted(false)
      ringRef.current.mutate(alarmId)
    }, Math.max(0, delay))
    return () => window.clearTimeout(t)
  }, [snoozedUntil, alarmId])

  // Vibra em ciclos enquanto toca (Android).
  useEffect(() => {
    if (!ringing || confirmed || !('vibrate' in navigator)) return
    const tick = () => navigator.vibrate?.([300, 200, 300])
    tick()
    const t = window.setInterval(tick, 2000)
    return () => {
      window.clearInterval(t)
      navigator.vibrate?.(0)
    }
  }, [ringing, confirmed])

  if (day.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6 text-ink-faint" />
      </div>
    )
  }
  if (day.isError || !d) {
    return <Idle message={day.isError ? errorMessage(day.error) : undefined} />
  }

  if (confirmed) return <Confirmed day={d} timezone={user.timezone} />
  if (d.status !== 'pending' && d.status !== 'missed') return <Idle />

  const missed = d.status === 'missed'
  const requiresHold = d.alarm?.requires_confirmation ?? true

  return (
    <Screen className={cn('transition-colors duration-700', ringing && !muted && 'bg-accent-soft/40')}>
      <header className="flex items-center justify-between">
        <p className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">
          {missed ? 'Alarme perdido' : snoozedUntil ? 'Soneca' : 'Alarme'}
        </p>
        {ringing && (
          <button type="button" onClick={() => setMuted((v) => !v)} className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-ink-muted">
            {muted ? 'Ligar som' : 'Silenciar'}
          </button>
        )}
      </header>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <m.p
          className="tabular text-[88px] leading-none font-semibold tracking-[-0.04em]"
          animate={ringing && !muted ? { scale: [1, 1.02, 1] } : { scale: 1 }}
          transition={ringing && !muted ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
        >
          {clock}
        </m.p>
        <p className="mt-3 text-[15px] text-ink-muted first-letter:uppercase">{longDate()}</p>

        <div className="mt-8 rounded-full border border-line bg-surface px-4 py-1.5 text-[14px] text-ink-muted">
          <span className="font-semibold text-ink">{d.alarm?.label ?? 'Acordar'}</span>
          {d.scheduled_at && <span> · {timeIn(d.scheduled_at, user.timezone)}</span>}
          {d.snooze_count > 0 && <span> · {d.snooze_count === 1 ? '1 soneca' : `${d.snooze_count} sonecas`}</span>}
        </div>

        {missed && (
          <p className="mt-6 max-w-xs text-[14px] leading-relaxed text-ink-muted">
            Você não confirmou em 60 minutos. Pode confirmar agora: fica registrado como manual, com o horário real.
          </p>
        )}
        {snoozedUntil && (
          <p className="mt-6 text-[15px] text-ink-muted">
            Toca de novo às <span className="tabular font-semibold text-ink">{timeIn(snoozedUntil, user.timezone)}</span>
            <Countdown until={snoozedUntil} />
          </p>
        )}
      </div>

      {error && <p className="mb-3 text-center text-[13px] text-danger">{error}</p>}

      <div className="flex flex-col gap-3">
        {requiresHold || missed ? (
          <HoldButton onComplete={() => confirm.mutate(undefined, { onError: (e) => setError(errorMessage(e)) })} disabled={confirm.isPending}>
            Segure para confirmar que levantou
          </HoldButton>
        ) : (
          <Button size="lg" full loading={confirm.isPending} onClick={() => confirm.mutate(undefined, { onError: (e) => setError(errorMessage(e)) })}>
            Levantei
          </Button>
        )}
        {d.can_snooze && !snoozedUntil && (
          <Button variant="secondary" size="lg" full loading={snooze.isPending} onClick={() => snooze.mutate(undefined, { onError: (e) => setError(errorMessage(e)) })}>
            Soneca de {d.alarm?.snooze_minutes ?? 5} min
            {d.alarm && d.alarm.max_snoozes > 1 && (
              <span className="ml-1 text-ink-faint">· {d.alarm.max_snoozes - d.snooze_count} restante{d.alarm.max_snoozes - d.snooze_count === 1 ? '' : 's'}</span>
            )}
          </Button>
        )}
        {missed && (
          <Link to="/hoje" className="py-2 text-center text-[14px] text-ink-muted">
            Agora não
          </Link>
        )}
      </div>
    </Screen>
  )
}

function Confirmed({ day, timezone }: { day: WakeDay; timezone: string }) {
  const navigate = useNavigate()
  const minutes = day.delay_minutes
  const delay =
    minutes === null
      ? null
      : Math.abs(minutes) <= 5
        ? 'No horário.'
        : minutes > 0
          ? `${minutes} min depois do horário.`
          : `${Math.abs(minutes)} min antes do horário.`
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <m.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }} className="flex size-20 items-center justify-center rounded-full bg-accent text-on-accent">
          <svg className="size-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </m.div>
        <p className="mt-8 text-[13px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Levantou às</p>
        <p className="tabular mt-1 text-[64px] leading-none font-semibold tracking-[-0.04em]">{day.confirmed_at ? timeIn(day.confirmed_at, timezone) : '--:--'}</p>
        {delay && <p className="mt-4 text-[15px] text-ink-muted">{delay}</p>}
        {day.snooze_count > 0 && <p className="mt-1 text-[13px] text-ink-faint">{day.snooze_count === 1 ? '1 soneca' : `${day.snooze_count} sonecas`}</p>}
      </div>
      <Button size="lg" full onClick={() => navigate('/hoje', { replace: true })}>
        Começar o dia
      </Button>
    </Screen>
  )
}

function Idle({ message }: { message?: string }) {
  const alarms = useAlarms()
  const user = useAuth((s) => s.user)!
  const next = alarms.data?.next
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-[20px] font-semibold tracking-[-0.02em]">Nenhum alarme tocando</p>
        <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-ink-muted">
          {message ??
            (next
              ? `Próximo: ${next.label} às ${timeIn(next.at, user.timezone)}. Deixe o app aberto na cabeceira ou ative as notificações.`
              : 'Você não tem alarme ativo. Crie um em Rotina → Despertador.')}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Link to="/despertador" className="block">
          <Button variant="secondary" size="lg" full>
            Ver alarmes
          </Button>
        </Link>
        <Link to="/hoje" className="block">
          <Button variant="ghost" full>
            Voltar para Hoje
          </Button>
        </Link>
      </div>
    </Screen>
  )
}

/** Moldura de tela cheia: fundo na janela inteira, conteúdo na coluna do app. */
function Screen({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-h-dvh bg-canvas', className)}>
      <div className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-lg flex-col px-5 pt-4 pb-6">{children}</div>
    </div>
  )
}

function Countdown({ until }: { until: string }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(until).getTime() - Date.now()))
  useEffect(() => {
    const t = window.setInterval(() => setLeft(Math.max(0, new Date(until).getTime() - Date.now())), 1000)
    return () => window.clearInterval(t)
  }, [until])
  const total = Math.round(left / 1000)
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return (
    <span className="tabular ml-2 text-ink-faint">
      ({mm}:{ss})
    </span>
  )
}

function useClock(): string {
  const fmt = () => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())
  const [now, setNow] = useState(fmt)
  useEffect(() => {
    const t = window.setInterval(() => setNow(fmt()), 1000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

function useAlarmSound(active: boolean, sound: AlarmSound) {
  useEffect(() => {
    if (!active) return
    const player = createAlarmPlayer(sound)
    player.start()
    return () => player.stop()
  }, [active, sound])
}

/** Mantém a tela acesa enquanto o alarme está pendente (API Wake Lock; sem ela, só ignora). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        lock = null
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}
