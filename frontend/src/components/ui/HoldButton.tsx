import { m, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/format'

interface HoldButtonProps {
  /** Tempo de pressão necessário, em ms */
  duration?: number
  onComplete: () => void
  children: ReactNode
  className?: string
  disabled?: boolean
}

/**
 * Botão de "segurar para confirmar". Atrito proposital: usado no "Levantei" do despertador.
 * Preenche da esquerda para a direita enquanto pressionado; solta antes do fim, cancela.
 */
export function HoldButton({ duration = 3000, onComplete, children, className, disabled }: HoldButtonProps) {
  const reduce = useReducedMotion()
  const [holding, setHolding] = useState(false)
  const [done, setDone] = useState(false)
  const timer = useRef<number | null>(null)

  const cancel = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    setHolding(false)
  }, [])

  const start = useCallback(() => {
    if (disabled || done) return
    setHolding(true)
    timer.current = window.setTimeout(() => {
      setDone(true)
      setHolding(false)
      if ('vibrate' in navigator) navigator.vibrate?.(30)
      onComplete()
    }, duration)
  }, [disabled, done, duration, onComplete])

  useEffect(() => () => cancel(), [cancel])

  return (
    <button
      type="button"
      disabled={disabled || done}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'relative h-16 w-full touch-none overflow-hidden rounded-xl border select-none',
        'text-[17px] font-semibold tracking-[-0.01em] transition-colors',
        done ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-elevated text-ink',
        className,
      )}
    >
      <m.span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-accent"
        initial={false}
        animate={{ width: holding ? '100%' : done ? '100%' : '0%' }}
        transition={
          holding ? { duration: reduce ? 0 : duration / 1000, ease: 'linear' } : { duration: 0.2 }
        }
      />
      <span className={cn('relative z-10 mix-blend-difference', holding && 'text-white')}>{children}</span>
    </button>
  )
}
