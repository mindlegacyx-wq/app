import { relativeDay } from '@/lib/format'
import type { ExamKind, StudySession } from '@/lib/types'

export const examKindLabel: Record<ExamKind, string> = { exam: 'Prova', assignment: 'Trabalho' }

/** "hoje" · "amanhã" · "em 5 dias" · "há 2 dias" */
export function describeDaysUntil(days: number): string {
  if (days === 0) return 'hoje'
  if (days === 1) return 'amanhã'
  if (days > 1) return `em ${days} dias`
  if (days === -1) return 'ontem'
  return `há ${-days} dias`
}

/** "ter, 23 set" com inicial maiúscula. */
export function examDateLabel(ymd: string, today: string): string {
  const s = relativeDay(ymd, today)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/** Tempo de foco humano: "menos de 1 min" · "25 min" · "1h10". */
export function fmtFocus(seconds: number): string {
  if (seconds < 60) return 'menos de 1 min'
  return fmtMinutes(Math.round(seconds / 60))
}

/** "25:04" a partir de segundos. */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function sessionStatusLabel(s: Pick<StudySession, 'status'>): string {
  switch (s.status) {
    case 'completed':
      return 'Concluída'
    case 'in_progress':
      return 'Em andamento'
    case 'skipped':
      return 'Pulada'
    default:
      return 'Pendente'
  }
}

export const LEAD_DAYS_OPTIONS = [3, 5, 7, 10, 14] as const
export const MINUTES_OPTIONS = [20, 30, 45, 60, 90] as const
