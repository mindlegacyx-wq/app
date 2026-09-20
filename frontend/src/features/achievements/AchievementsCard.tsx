import { Link } from 'react-router'

import { Card } from '@/components/ui'
import { cn } from '@/lib/format'

import { useAchievements } from './api'
import { BadgeIcon } from './BadgeIcon'
import { familyColor } from './shared'

/** Resumo na Evolução: quantos selos e os três mais recentes. */
export function AchievementsCard({ className }: { className?: string }) {
  const { data } = useAchievements()
  if (!data) return null
  const recent = data.items.filter((i) => i.unlocked).slice(0, 3)

  return (
    <Link to="/conquistas" className={cn('block', className)}>
      <Card className="flex items-center gap-3.5 p-4 transition-colors active:bg-elevated">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] tracking-[0.14em] text-ink-faint uppercase">Conquistas</p>
          <p className="mt-0.5 text-[20px] leading-none font-semibold tabular-nums">
            {data.unlocked} <span className="text-[14px] font-normal text-ink-faint">de {data.total}</span>
          </p>
          <p className="mt-1.5 truncate text-[13px] text-ink-muted">
            {recent.length > 0 ? recent.map((r) => r.name).join(' · ') : 'Nenhum selo ainda. Comece pela sequência.'}
          </p>
        </div>
        <div className="flex shrink-0 -space-x-2">
          {(recent.length > 0 ? recent : data.items.slice(0, 3)).map((item) => {
            const color = familyColor(item.family)
            return (
              <span
                key={item.key}
                className="grid size-9 place-items-center rounded-full border-2 border-surface"
                style={{
                  background: item.unlocked ? `${color}22` : 'rgb(255 255 255 / 4%)',
                  color: item.unlocked ? color : 'var(--color-ink-faint)',
                }}
              >
                <BadgeIcon icon={item.icon} className="size-5" />
              </span>
            )
          })}
        </div>
      </Card>
    </Link>
  )
}
