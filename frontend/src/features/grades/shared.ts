import type { SubjectGradeStatus } from '@/lib/types'

/** "1º trimestre" · "2º bimestre" · "1º semestre" · "3º período" */
export function periodLabel(period: number, periodsPerYear: number, short = false): string {
  const name = periodsPerYear === 2 ? 'semestre' : periodsPerYear === 3 ? 'trimestre' : periodsPerYear === 4 ? 'bimestre' : 'período'
  return `${period}º ${short ? name.slice(0, 3) : name}`
}

export function periodsName(periodsPerYear: number): string {
  return periodsPerYear === 2 ? 'semestres' : periodsPerYear === 3 ? 'trimestres' : periodsPerYear === 4 ? 'bimestres' : 'períodos'
}

/** 7.5 → "7,5" · 7 → "7" · 6.25 → "6,25" */
export function fmtGrade(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v)
}

/** "7,5" ou "7.5" → 7.5 (null se inválido) */
export function parseGrade(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'))
  return Number.isFinite(n) && text.trim() !== '' ? Math.round(n * 100) / 100 : null
}

export const statusLabel: Record<SubjectGradeStatus, string> = {
  approved: 'Média garantida',
  on_track: 'No caminho',
  at_risk: 'Em risco',
  failing: 'Só com recuperação',
  no_grades: 'Sem notas',
  closed_failed: 'Abaixo da média',
}

export function statusTone(s: SubjectGradeStatus): string {
  switch (s) {
    case 'approved':
      return 'text-accent'
    case 'at_risk':
      return 'text-warning'
    case 'failing':
    case 'closed_failed':
      return 'text-danger'
    default:
      return 'text-ink-muted'
  }
}
