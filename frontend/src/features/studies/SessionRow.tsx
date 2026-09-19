import { Link } from 'react-router'

import { cn, shortTime } from '@/lib/format'
import type { StudySession } from '@/lib/types'

import { fmtFocus, fmtMinutes } from './shared'

/** Linha de uma sessão de estudo (Hoje e aba Estudos): estado + atalho para o cronômetro. */
export function SessionRow({ session: s }: { session: StudySession }) {
  const done = s.status === 'completed'
  const cta = done ? 'Ver' : s.status === 'in_progress' ? 'Continuar' : s.status === 'skipped' ? 'Retomar' : 'Estudar'
  const meta = done
    ? `Concluída · ${fmtFocus(s.focused_seconds)} de foco`
    : s.status === 'skipped'
      ? 'Pulada hoje'
      : `${fmtMinutes(s.planned_minutes)}${s.suggested_start ? ` · sugestão ${shortTime(s.suggested_start)}` : ''}`
  return (
    <li>
      <Link to={`/estudos/${s.exam_id}/sessao/${s.date}`} className="flex items-stretch gap-3 transition-colors hover:bg-elevated">
        <span className="w-1 shrink-0" style={{ background: s.subject_color ?? '#B57BFF' }} aria-hidden />
        <span className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-4">
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full border-2',
              done ? 'border-accent bg-accent text-on-accent' : 'border-line-strong text-ink-faint',
            )}
            aria-hidden
          >
            {done ? (
              <svg
                viewBox="0 0 16 16"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
            ) : s.status === 'skipped' ? (
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : s.status === 'in_progress' ? (
              <span className="size-2.5 rounded-full bg-accent" />
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[15px]', done && 'text-ink-faint line-through')}>{s.exam_title}</span>
            <span className="block truncate text-[12px] text-ink-faint">{meta}</span>
          </span>
          <span className="shrink-0 text-[13px] font-semibold text-accent">{cta}</span>
        </span>
      </Link>
    </li>
  )
}
