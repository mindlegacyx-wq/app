import { cn } from '@/lib/format'
import type { Achievement } from '@/lib/types'

import { BadgeIcon } from './BadgeIcon'
import { familyColor, unlockedLabel } from './shared'

/** Um selo na vitrine: colorido quando conquistado, apagado com barrinha quando não. */
export function Badge({ item, size = 'md' }: { item: Achievement; size?: 'sm' | 'md' }) {
  const color = familyColor(item.family)
  const pct = Math.round((item.progress / item.target) * 100)

  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border p-3 text-center transition-colors',
        item.unlocked ? 'border-line-strong bg-elevated' : 'border-line bg-surface',
      )}
    >
      <div
        className="grid place-items-center rounded-full"
        style={{
          width: size === 'md' ? 52 : 42,
          height: size === 'md' ? 52 : 42,
          background: item.unlocked ? `${color}22` : 'rgb(255 255 255 / 4%)',
          color: item.unlocked ? color : 'var(--color-ink-faint)',
          boxShadow: item.unlocked ? `0 0 18px -6px ${color}` : undefined,
        }}
      >
        <BadgeIcon icon={item.icon} className={size === 'md' ? 'size-7' : 'size-5'} />
      </div>

      <p className={cn('mt-2 text-[13px] leading-tight font-semibold', !item.unlocked && 'text-ink-muted')}>{item.name}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-ink-faint">{item.hint}</p>

      {item.unlocked ? (
        <p className="mt-2 text-[11px] font-medium" style={{ color }}>
          {unlockedLabel(item.unlocked_at)}
        </p>
      ) : (
        <div className="mt-2 w-full">
          <div className="h-1 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-ink-faint" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-ink-faint tabular-nums">
            {item.progress} / {item.target}
          </p>
        </div>
      )}
    </div>
  )
}
