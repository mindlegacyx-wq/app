import { useState } from 'react'
import { Link } from 'react-router'

import { TopBar } from '@/app/shell/TopBar'
import { Button, Card, EmptyState, Fab, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, pluralize, todayIn } from '@/lib/format'
import type { Exam } from '@/lib/types'

import { useGrades } from '@/features/grades/api'
import { fmtGrade, statusLabel } from '@/features/grades/shared'

import { ExamSheet } from './ExamSheet'
import { SessionRow } from './SessionRow'
import { useExams, useStudyDay } from './api'
import { describeDaysUntil, examDateLabel, examKindLabel, fmtMinutes } from './shared'

/** Tela 32: aba Estudos — sessões de hoje, próximas provas/trabalhos, passadas. */
export function StudiesPage() {
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)
  const [showPast, setShowPast] = useState(false)
  const exams = useExams(showPast)
  const day = useStudyDay(today)
  const [creating, setCreating] = useState(false)

  const upcoming = (exams.data ?? []).filter((e) => e.status === 'open' && e.date >= today)
  const past = (exams.data ?? []).filter((e) => e.status !== 'open' || e.date < today).sort((a, b) => (a.date < b.date ? 1 : -1))
  const sessions = day.data?.sessions ?? []

  return (
    <>
      <TopBar title="Estudos" />

      {exams.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : exams.isError ? (
        <EmptyState className="mt-6" title="Não foi possível carregar" description={errorMessage(exams.error)} />
      ) : upcoming.length === 0 && !showPast ? (
        <EmptyState
          className="mt-4"
          title="Nenhuma prova ou trabalho"
          description="Cadastre a data e o app monta as sessões de estudo nos dias anteriores, encaixadas nos buracos da sua agenda. Cada sessão entra no percentual do dia."
          action={<Button onClick={() => setCreating(true)}>Cadastrar a primeira</Button>}
        />
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <div className="flex items-baseline justify-between px-0.5">
            <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Hoje</h2>
            {day.data && day.data.planned > 0 && (
              <span className={cn('tabular text-[13px] text-ink-muted', day.data.completed === day.data.planned && 'text-accent')}>
                {day.data.completed}/{day.data.planned} · {fmtMinutes(day.data.total_minutes)}
              </span>
            )}
          </div>
          {day.isPending ? (
            <Card className="flex h-14 items-center justify-center">
              <Spinner className="size-5 text-ink-faint" />
            </Card>
          ) : sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong px-4 py-3.5">
              <p className="text-[14px] text-ink-muted">
                Nenhuma sessão hoje. As próximas começam quando a prova entrar na janela de estudo.
              </p>
            </div>
          ) : (
            <Card padded={false} className="overflow-hidden">
              <ol className="divide-y divide-line">
                {sessions.map((s) => (
                  <SessionRow key={s.exam_id} session={s} />
                ))}
              </ol>
            </Card>
          )}

          <h2 className="mt-3 px-0.5 text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Próximas</h2>
          {upcoming.length === 0 ? (
            <EmptyState compact title="Nada por vir" description="Cadastre a próxima prova ou trabalho." />
          ) : (
            upcoming.map((e) => <ExamCard key={e.id} exam={e} today={today} />)
          )}

          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="mt-2 self-start px-0.5 text-[13px] font-semibold text-accent"
          >
            {showPast ? 'Ocultar passadas e feitas' : 'Ver passadas e feitas'}
          </button>
          {showPast &&
            (past.length === 0 ? (
              <p className="px-0.5 text-[13px] text-ink-faint">Nenhuma ainda.</p>
            ) : (
              past.map((e) => <ExamCard key={e.id} exam={e} today={today} muted />)
            ))}
        </div>
      )}

      <div className="mt-6 px-0.5">
        <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Notas</h2>
      </div>
      <GradesCard />

      <Fab label="Nova prova ou trabalho" onClick={() => setCreating(true)} />
      <ExamSheet open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

function ExamCard({ exam, today, muted }: { exam: Exam; today: string; muted?: boolean }) {
  const pct = exam.sessions_total ? Math.round((exam.sessions_done * 100) / exam.sessions_total) : 0
  const urgent = !muted && exam.days_until >= 0 && exam.days_until <= 2
  return (
    <Link to={`/estudos/${exam.id}`} className="block">
      <Card padded={false} className={cn('flex items-stretch overflow-hidden transition-colors hover:bg-elevated', muted && 'opacity-60')}>
        <span className="w-1.5 shrink-0" style={{ background: exam.subject_color ?? '#9CA3AF' }} aria-hidden />
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
                {examKindLabel[exam.kind]}
                {exam.subject_name && ` · ${exam.subject_name}`}
              </p>
              <h3 className="mt-0.5 truncate text-[17px] font-semibold tracking-[-0.01em]">{exam.title}</h3>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] font-semibold">{examDateLabel(exam.date, today)}</p>
              <p className={cn('text-[12px]', urgent ? 'font-semibold text-accent' : 'text-ink-faint')}>
                {exam.status === 'done' ? (exam.kind === 'exam' ? 'feita' : 'entregue') : describeDaysUntil(exam.days_until)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular shrink-0 text-[12px] text-ink-muted">
              {exam.sessions_done}/{exam.sessions_total} {exam.sessions_total === 1 ? 'sessão' : 'sessões'}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-faint">
            {fmtMinutes(exam.minutes_per_day)}/dia
            {exam.topics_total > 0 && ` · ${exam.topics_done}/${pluralize(exam.topics_total, 'conteúdo', 'conteúdos')}`}
          </p>
        </div>
      </Card>
    </Link>
  )
}

/** Atalho para as notas (tela 36): média mínima e quantas matérias pedem atenção. */
function GradesCard() {
  const grades = useGrades()
  const subjects = grades.data?.subjects ?? []
  const withGrades = subjects.filter((s) => s.status !== 'no_grades')
  const attention = subjects.filter((s) => s.status === 'at_risk' || s.status === 'failing' || s.status === 'closed_failed')
  const title = grades.isPending
    ? 'Notas'
    : subjects.length === 0
      ? 'Notas por matéria'
      : withGrades.length === 0
        ? 'Nenhuma nota lançada'
        : attention.length === 0
          ? 'Todas as matérias no caminho'
          : `${attention.length} ${attention.length === 1 ? 'matéria pede' : 'matérias pedem'} atenção`
  const detail =
    subjects.length === 0
      ? 'Crie as matérias na agenda e lance as notas de cada período.'
      : attention.length > 0
        ? attention.map((s) => `${s.name}: ${statusLabel[s.status].toLowerCase()}`).join(' · ')
        : `Média mínima ${fmtGrade(grades.data?.passing_grade)} · toque para lançar e ver quanto falta.`
  return (
    <Link to="/estudos/notas" className="mt-3 block">
      <Card className="flex items-center justify-between gap-3 transition-colors hover:bg-elevated">
        <div className="min-w-0">
          <p className={cn('text-[15px]', attention.length > 0 && 'text-warning')}>{title}</p>
          <p className="mt-0.5 truncate text-[13px] text-ink-faint">{detail}</p>
        </div>
        <svg
          className="size-4 shrink-0 text-ink-faint"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </Card>
    </Link>
  )
}
