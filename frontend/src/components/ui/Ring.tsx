import { useEffect, useState, type ReactNode } from 'react'

import { cn } from '@/lib/format'

interface RingProps {
  /** 0 a 100 */
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
  className?: string
  muted?: boolean
}

/**
 * Anel de progresso. É o elemento visual central do produto.
 * Anima via transição CSS de stroke-dashoffset (leve, respeita prefers-reduced-motion).
 */
export function Ring({ value, size = 160, stroke = 12, children, className, muted = false }: RingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))

  // Começa em 0 e transiciona até o valor no primeiro paint.
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(clamped))
    return () => cancelAnimationFrame(id)
  }, [clamped])

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped)} por cento`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-white/8"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className={cn(
            'transition-[stroke-dashoffset] duration-900 ease-out-quart',
            muted ? 'text-ink-faint' : 'text-accent',
          )}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
