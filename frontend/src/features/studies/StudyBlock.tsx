import { Link } from 'react-router'

import { Card, Section, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/format'

import { SessionRow } from './SessionRow'
import { useStudyDay } from './api'
import { fmtMinutes } from './shared'

/** Bloco "Estudos" da tela Hoje: as sessões que as provas cobram hoje. Some quando não há nenhuma. */
export function StudyBlock({ date }: { date: string }) {
  const day = useStudyDay(date)
  const sessions = day.data?.sessions ?? []
  if (day.data && sessions.length === 0) return null

  const aside = day.data && day.data.planned > 0 && (
    <span className="flex items-center gap-2">
      <span className="text-ink-faint">{fmtMinutes(day.data.total_minutes)}</span>
      <span className={cn('tabular', day.data.completed === day.data.planned && 'text-accent')}>
        {day.data.completed}/{day.data.planned}
      </span>
    </span>
  )

  return (
    <Section title="Estudos" aside={aside}>
      {day.isPending ? (
        <Card className="flex h-14 items-center justify-center">
          <Spinner className="size-5 text-ink-faint" />
        </Card>
      ) : day.isError ? (
        <Card className="text-[14px] text-ink-muted">{errorMessage(day.error)}</Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <ol className="divide-y divide-line">
            {sessions.map((s) => (
              <SessionRow key={s.exam_id} session={s} />
            ))}
          </ol>
          <Link to="/estudos" className="block border-t border-line px-4 py-2.5 text-center text-[13px] font-semibold text-accent">
            Ver provas e trabalhos
          </Link>
        </Card>
      )}
    </Section>
  )
}
