import { m } from 'motion/react'

import { TopBar } from '@/app/shell/TopBar'
import { Card, EmptyState, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/format'
import type { League } from '@/lib/types'

import { useLeague } from './api'
import { LeagueRow } from './LeagueRow'
import { daysLeftLabel, TIERS, tierColor, tierLabel } from './shared'
import { TierShield } from './TierShield'

/** Tela 42: a liga da semana — você e seis robôs, com zonas de subida e queda. */
export function LeaguePage() {
  const { data, isPending, isError, error } = useLeague()

  return (
    <>
      <TopBar title="Liga" />
      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : isError ? (
        <EmptyState className="mt-6" title="Não foi possível carregar" description={errorMessage(error)} />
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <Header league={data} />
          <Table league={data} />
          <Rules league={data} />
        </div>
      )}
    </>
  )
}

function Header({ league }: { league: League }) {
  const color = tierColor(league.tier)
  return (
    <Card className="flex items-center gap-4 p-4">
      <TierShield tier={league.tier} size={52} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] tracking-[0.14em] text-ink-faint uppercase">Divisão</p>
        <p className="text-[20px] leading-tight font-semibold tracking-[-0.02em]" style={{ color }}>
          {tierLabel(league.tier)}
        </p>
        <p className="mt-0.5 text-[13px] text-ink-muted">{daysLeftLabel(league.days_left)} nesta semana</p>
      </div>
      <div className="text-right">
        <p className="text-[26px] leading-none font-semibold tabular-nums">{league.your_rank}º</p>
        <p className="mt-1 text-[11px] text-ink-faint">seu lugar</p>
      </div>
    </Card>
  )
}

function Table({ league }: { league: League }) {
  const promotion = league.can_promote ? league.promotion_slots : 0
  const relegation = league.can_relegate ? league.relegation_slots : 0
  const total = league.members.length

  return (
    <Card className="overflow-hidden p-0">
      <ul>
        {league.members.map((member, i) => {
          const zone = i < promotion ? 'promotion' : i >= total - relegation ? 'relegation' : null
          const firstOut = i === promotion && promotion > 0
          const firstDown = i === total - relegation && relegation > 0
          return (
            <li key={member.key}>
              {firstOut && <Divider label={`Sobem para ${TIERS[league.tier].next}`} tone="up" />}
              {firstDown && <Divider label="Caem de divisão" tone="down" />}
              <m.div layout={false} className={cn(i > 0 && !firstOut && !firstDown && 'border-t border-line')}>
                <LeagueRow member={member} zone={zone} />
              </m.div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Divider({ label, tone }: { label: string; tone: 'up' | 'down' }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3.5 py-1.5 text-[11px] font-medium tracking-wide uppercase',
        tone === 'up' ? 'bg-accent-soft text-accent' : 'bg-danger-soft text-danger',
      )}
    >
      <span className="h-px flex-1 bg-current opacity-30" />
      {label}
      <span className="h-px flex-1 bg-current opacity-30" />
    </div>
  )
}

function Rules({ league }: { league: League }) {
  const next = TIERS[league.tier].next
  return (
    <Card className="p-4">
      <p className="text-[13px] leading-relaxed text-ink-muted">
        Toda segunda-feira a liga vira.{' '}
        {league.can_promote ? (
          <>
            Os <strong className="text-ink">{league.promotion_slots} primeiros</strong> sobem para {next}.{' '}
          </>
        ) : (
          <>Você está na divisão mais alta — aqui só dá para se manter. </>
        )}
        {league.can_relegate ? (
          <>
            Os <strong className="text-ink">{league.relegation_slots} últimos</strong> caem.
          </>
        ) : (
          <>No Bronze ninguém cai.</>
        )}
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
        Os seis adversários são robôs com ritmos diferentes: uns entregam cedo, outros viram a noite. O XP deles cresce ao longo do dia,
        igual ao seu.
      </p>
      {league.to_next_rank !== null && league.to_next_rank > 0 && (
        <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-muted">
          Faltam <strong className="text-ink tabular-nums">{league.to_next_rank} XP</strong> para passar quem está na sua frente.
        </p>
      )}
    </Card>
  )
}
