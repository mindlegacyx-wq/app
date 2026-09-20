import { m, useReducedMotion } from 'motion/react'

import { Card } from '@/components/ui'

import { usePlayer } from './api'
import { LevelBadge } from './LevelBadge'
import { levelPct, rankColor } from './shared'

/** Cartão do nível na Evolução: o número completo, a patente e o que falta para subir. */
export function LevelCard() {
  const { data } = usePlayer()
  const reduced = useReducedMotion()
  if (!data) return null

  const color = rankColor(data.title)
  const pct = levelPct(data.into_level, data.level_span)

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <LevelBadge level={data.level} title={data.title} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] tracking-[0.14em] text-ink-faint uppercase">Nível {data.level}</p>
          <p className="truncate text-[20px] leading-tight font-semibold tracking-[-0.02em]" style={{ color }}>
            {data.title}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[20px] leading-none font-semibold tabular-nums">{data.total_xp.toLocaleString('pt-BR')}</p>
          <p className="mt-1 text-[11px] text-ink-faint">XP total</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
        <m.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between text-[12px] text-ink-muted">
        <span className="tabular-nums">
          {data.into_level.toLocaleString('pt-BR')} / {data.level_span.toLocaleString('pt-BR')} XP
        </span>
        <span>{data.max_level ? 'Nível máximo' : `Faltam ${data.to_next.toLocaleString('pt-BR')} para o ${data.level + 1}`}</span>
      </div>

      {data.xp_today > 0 && (
        <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-muted">
          Hoje você já somou <span className="font-semibold text-ink tabular-nums">{data.xp_today} XP</span>.
        </p>
      )}
    </Card>
  )
}
