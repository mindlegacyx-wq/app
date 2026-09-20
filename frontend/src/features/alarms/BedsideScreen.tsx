import { m, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { useAuth } from '@/lib/auth-store'
import { describeNextRing, timeIn, todayIn } from '@/lib/format'
import { useWakeLock } from '@/lib/wake-lock'

import { useAlarms } from './api'
import { unlockAudio } from './sounds'

/**
 * Modo cabeceira: o jeito mais confiável de um app web acordar alguém.
 *
 * Com a tela aberta, o alarme não depende de notificação: o relógio do próprio app dispara
 * na hora (ver AlarmWatcher) e toca o áudio escolhido no volume cheio. Entrar aqui é um
 * gesto do usuário, o que também destrava o áudio para tocar sozinho depois.
 */
export function BedsideScreen() {
  const user = useAuth((s) => s.user)!
  const alarms = useAlarms({ refetchInterval: 5 * 60_000 })
  const reduced = useReducedMotion()
  const [now, setNow] = useState(() => new Date())
  const [dim, setDim] = useState(false)

  useWakeLock(true)
  useEffect(() => {
    unlockAudio()
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Escurece sozinho depois de meio minuto parado; qualquer toque acende de novo.
  useEffect(() => {
    const timer = window.setTimeout(() => setDim(true), 30_000)
    return () => window.clearTimeout(timer)
  }, [dim])

  const next = alarms.data?.next ?? null
  const clock = timeIn(now.toISOString(), user.timezone)
  const today = todayIn(user.timezone)

  return (
    <div
      onPointerDown={() => setDim(false)}
      className="safe-top fixed inset-0 z-40 flex flex-col items-center justify-center bg-black px-6 text-center"
    >
      <m.div
        animate={{ opacity: dim ? 0.35 : 1 }}
        transition={{ duration: reduced ? 0 : 1.2, ease: 'easeInOut' }}
        className="flex flex-col items-center"
      >
        <p className="text-[64px] leading-none font-semibold tracking-[-0.04em] tabular-nums">{clock}</p>
        <p className="mt-2 text-[14px] text-ink-faint first-letter:uppercase">{longDay(today)}</p>

        <p className="mt-10 text-[13px] tracking-[0.14em] text-ink-faint uppercase">Próximo alarme</p>
        <p className="mt-1 text-[17px] text-ink-muted first-letter:uppercase">
          {next ? `${next.label} · ${describeNextRing(next.at, user.timezone)}` : 'Nenhum alarme ativo'}
        </p>
      </m.div>

      <m.div
        animate={{ opacity: dim ? 0.15 : 1 }}
        transition={{ duration: reduced ? 0 : 1.2 }}
        className="absolute inset-x-6 bottom-10 flex flex-col items-center gap-3"
      >
        <p className="text-[12px] leading-relaxed text-ink-faint">
          Deixe o celular carregando com esta tela aberta. Na hora, o alarme toca aqui com o seu áudio, no volume
          do aparelho — sem depender de notificação.
        </p>
        <Link
          to="/despertador"
          className="rounded-full border border-line-strong px-5 py-2.5 text-[14px] font-semibold text-ink-muted"
        >
          Sair do modo cabeceira
        </Link>
      </m.div>
    </div>
  )
}

function longDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y!, (m ?? 1) - 1, d)
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}
