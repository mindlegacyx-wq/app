import { cn } from '@/lib/format'

import { rankColor } from './shared'

interface Props {
  level: number
  title: string
  size?: number
  className?: string
  glow?: boolean
}

/** Hexágono com o número do nível. Cor vem da patente. */
export function LevelBadge({ level, title, size = 34, className, glow = false }: Props) {
  const color = rankColor(title)
  return (
    <div
      className={cn('relative grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
      aria-label={`Nível ${level}, ${title}`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
        <polygon
          points="50,3 93,27 93,73 50,97 7,73 7,27"
          fill={color}
          fillOpacity={0.14}
          stroke={color}
          strokeWidth={6}
          strokeLinejoin="round"
        />
      </svg>
      {glow && <span className="absolute inset-0 -z-10 rounded-full blur-lg" style={{ background: color, opacity: 0.35 }} aria-hidden />}
      <span className="relative font-semibold tabular-nums" style={{ color, fontSize: size * 0.42, lineHeight: 1 }}>
        {level}
      </span>
    </div>
  )
}
