import { cn } from '@/lib/format'
import type { LeagueMember } from '@/lib/types'

import { BotTag } from './BotTag'

interface Props {
  member: LeagueMember
  zone: 'promotion' | 'relegation' | null
  compact?: boolean
}

/** Uma linha da classificação. */
export function LeagueRow({ member, zone, compact = false }: Props) {
  return (
    <div className={cn('flex items-center gap-3 px-3.5', compact ? 'py-2' : 'py-2.5', member.is_you && 'bg-accent-soft')}>
      <span
        className={cn(
          'w-6 shrink-0 text-center text-[13px] font-semibold tabular-nums',
          zone === 'promotion' ? 'text-accent' : zone === 'relegation' ? 'text-danger' : 'text-ink-faint',
        )}
      >
        {member.rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('truncate text-[15px]', member.is_you ? 'font-semibold text-ink' : 'text-ink')}>{member.name}</span>
          {member.is_bot && <BotTag />}
        </div>
        {!compact && member.tagline && <p className="truncate text-[12px] text-ink-faint">{member.tagline}</p>}
      </div>
      <span className="shrink-0 text-[14px] font-semibold tabular-nums text-ink-muted">{member.xp.toLocaleString('pt-BR')}</span>
    </div>
  )
}
