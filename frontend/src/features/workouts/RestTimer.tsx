import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { buzz, levelUpSound } from '@/lib/sound'

import { fmtDuration } from './load'

interface Props {
  seconds: number | null // null = parado
  onDone: () => void
  onAdd: (extra: number) => void
  onSkip: () => void
  label?: string
}

/**
 * Descanso entre séries. Começa sozinho quando uma série é marcada.
 *
 * Conta pelo relógio (não por contador de ticks): se a tela apagar ou o app for para o fundo,
 * ao voltar o tempo está certo — que é justamente quando o descanso costuma acontecer.
 */
export function RestTimer({ seconds, onDone, onAdd, onSkip, label }: Props) {
  const reduced = useReducedMotion()
  const [left, setLeft] = useState(seconds ?? 0)
  const endsAt = useRef<number | null>(null)
  const rang = useRef(false)

  useEffect(() => {
    if (seconds === null) {
      endsAt.current = null
      return
    }
    endsAt.current = Date.now() + seconds * 1000
    rang.current = false
    setLeft(seconds)
    const id = window.setInterval(() => {
      if (endsAt.current === null) return
      const remaining = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000))
      setLeft(remaining)
      if (remaining === 0 && !rang.current) {
        rang.current = true
        levelUpSound()
        buzz([140, 70, 140])
        window.setTimeout(onDone, 1200)
      }
    }, 250)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds])

  const total = seconds ?? 1
  const pct = Math.max(0, Math.min(100, (left / total) * 100))
  const over = left === 0

  return (
    <AnimatePresence>
      {seconds !== null && (
        <m.div
          className="safe-bottom fixed inset-x-0 bottom-16 z-40 mx-auto w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-lg border border-line-strong bg-elevated shadow-sheet"
          initial={{ y: 70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 28 }}
        >
          <div className="h-1 bg-white/8">
            <div
              className={over ? 'h-full bg-accent' : 'h-full bg-accent/70 transition-[width] duration-300 ease-linear'}
              style={{ width: `${over ? 100 : pct}%` }}
            />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] tracking-[0.14em] text-ink-faint uppercase">
                {over ? 'Descanso acabou' : 'Descanso'}
                {label ? ` · ${label}` : ''}
              </p>
              <p className={`text-[24px] leading-none font-semibold tabular-nums ${over ? 'text-accent' : ''}`}>{fmtDuration(left)}</p>
            </div>
            <button
              type="button"
              onClick={() => onAdd(15)}
              className="rounded-full border border-line-strong px-3 py-1.5 text-[13px] font-medium active:bg-surface"
            >
              +15s
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-on-accent active:opacity-80"
            >
              {over ? 'Ok' : 'Pular'}
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
