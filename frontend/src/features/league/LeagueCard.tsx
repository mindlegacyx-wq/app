import { Link } from 'react-router'

import { Card } from '@/components/ui'
import { cn } from '@/lib/format'

import { useLeague } from './api'
import { daysLeftLabel, tierColor, tierLabel } from './shared'
import { TierShield } from './TierShield'

/** Cartão da liga (Hoje e Evolução): onde você está e quem está logo à frente. */
export function LeagueCard({ className }: { className?: string }) {
  const { data } = useLeague()
  if (!data) return null

  const above = data.your_rank > 1 ? data.members[data.your_rank - 2] : null
  const below = data.your_rank < data.members.length ? data.members[data.your_rank] : null
  const zone =
    data.can_promote && data.your_rank <= data.promotion_slots
      ? 'promotion'
      : data.can_relegate && data.your_rank > data.members.length - data.relegation_slots
        ? 'relegation'
        : null

  return (
    <Link to="/liga" className={cn('block', className)}>
      <Card className="flex items-center gap-3.5 p-3.5 transition-colors active:bg-elevated">
        <TierShield tier={data.tier} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-tight font-semibold">
            <span className="tabular-nums">{data.your_rank}º</span> na{' '}
            <span style={{ color: tierColor(data.tier) }}>{tierLabel(data.tier)}</span>
          </p>
          <p className="mt-0.5 truncate text-[13px] text-ink-muted">
            {above && data.to_next_rank !== null
              ? data.to_next_rank === 0
                ? `Empatado com ${above.name}.`
                : `${data.to_next_rank} XP para passar ${above.name}.`
              : below
                ? `${Math.max(0, data.your_xp - below.xp)} XP à frente de ${below.name}.`
                : 'A semana começou.'}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {daysLeftLabel(data.days_left)}
            {zone === 'promotion' ? ' · zona de subida' : zone === 'relegation' ? ' · zona de queda' : ''}
          </p>
        </div>
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Card>
    </Link>
  )
}
