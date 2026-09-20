import { cn } from '@/lib/format'
import type { Tier } from '@/lib/types'

import { tierColor } from './shared'

/** Escudo da divisão. Só muda de cor — a forma é a mesma em todas. */
export function TierShield({ tier, size = 36, className }: { tier: Tier; size?: number; className?: string }) {
  const color = tierColor(tier)
  return (
    <svg viewBox="0 0 48 52" style={{ width: size, height: (size * 52) / 48 }} className={cn('shrink-0', className)} aria-hidden>
      <path
        d="M24 2 44 9v18c0 12-8.5 19.5-20 23C12.5 46.5 4 39 4 27V9z"
        fill={color}
        fillOpacity={0.16}
        stroke={color}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path d="M24 14v20M16 22l8-8 8 8" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
