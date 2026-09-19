import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { Card, Section } from '@/components/ui'
import { cn, shortTime } from '@/lib/format'
import type { ScheduleBlock } from '@/lib/types'

import { useScheduleDay, useScheduleWeek } from './api'
import { blockColor, fmtDuration, kindLabel, nowHm, toMinutes } from './shared'

/** Minuto atual no fuso do usuário, atualizado a cada 30 s. */
function useNowMinutes(timezone: string): number {
  const [now, setNow] = useState(() => toMinutes(nowHm(timezone)))
  useEffect(() => {
    const id = window.setInterval(() => setNow(toMinutes(nowHm(timezone))), 30_000)
    return () => window.clearInterval(id)
  }, [timezone])
  return now
}

/**
 * Linha do tempo do dia na tela Hoje: aulas, curso, treino e outros blocos fixos da agenda.
 * Não entra no percentual — é referência de horário, não algo a "marcar".
 */
export function AgendaBlock({ date, timezone }: { date: string; timezone: string }) {
  const day = useScheduleDay(date)
  const week = useScheduleWeek()
  const now = useNowMinutes(timezone)
  const blocks = (day.data?.blocks ?? []).filter((b) => b.is_active)
  const weekHasBlocks = week.data?.days.some((d) => d.blocks.length > 0) ?? false

  // Sem agenda nenhuma: não ocupa espaço na tela Hoje.
  if (!day.data || (blocks.length === 0 && !weekHasBlocks)) return null

  const current = blocks.find((b) => toMinutes(b.start_time) <= now && now < toMinutes(b.end_time))
  const next = blocks.find((b) => toMinutes(b.start_time) > now)

  return (
    <Section
      title="Agenda de hoje"
      aside={
        <Link to="/agenda" className="font-semibold text-accent">
          Agenda
        </Link>
      }
    >
      {blocks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong px-4 py-3.5">
          <p className="text-[14px] text-ink-muted">Nenhum compromisso fixo hoje.</p>
        </div>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <ol className="divide-y divide-line">
            {blocks.map((b) => (
              <TimelineRow key={b.id} block={b} now={now} current={current?.id === b.id} next={next?.id === b.id} />
            ))}
          </ol>
        </Card>
      )}
    </Section>
  )
}

function TimelineRow({ block, now, current, next }: { block: ScheduleBlock; now: number; current: boolean; next: boolean }) {
  const start = toMinutes(block.start_time)
  const end = toMinutes(block.end_time)
  const past = end <= now
  const status = current
    ? `agora · termina ${shortTime(block.end_time)}`
    : next
      ? start - now < 60
        ? `em ${start - now} min`
        : `próximo · ${fmtDuration(block.duration_minutes)}`
      : past
        ? 'encerrado'
        : fmtDuration(block.duration_minutes)
  const detail = [
    block.kind === 'class' && block.subject_name && block.subject_name !== block.title ? block.subject_name : kindLabel[block.kind],
    block.location,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className={cn('flex items-stretch gap-3', past && 'opacity-50', current && 'bg-accent-soft/40')}>
      <span className="w-1 shrink-0" style={{ background: blockColor(block) }} aria-hidden />
      <div className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-4">
        <span className="tabular w-[44px] shrink-0 text-[13px] font-semibold">{shortTime(block.start_time)}</span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[15px]', current && 'font-semibold')}>{block.title}</span>
          <span className="block truncate text-[12px] text-ink-faint">{detail}</span>
        </span>
        <span className={cn('shrink-0 text-[12px]', current ? 'font-semibold text-accent' : next ? 'text-ink-muted' : 'text-ink-faint')}>
          {status}
        </span>
      </div>
    </li>
  )
}
