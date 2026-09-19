import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'

import { Button, Card, Checkbox, EmptyState, Field, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, relativeDay, todayIn } from '@/lib/format'
import type { StudySession } from '@/lib/types'

import { GradeSheet } from '@/features/grades/GradeSheet'
import { useGrades } from '@/features/grades/api'
import { fmtGrade } from '@/features/grades/shared'

import { AISection } from './AISection'
import { ExamSheet } from './ExamSheet'
import { useAddTopic, useDeleteTopic, useExam, useUpdateTopic } from './api'
import { describeDaysUntil, examDateLabel, examKindLabel, fmtFocus, fmtMinutes, sessionStatusLabel } from './shared'

/** Tela 34: detalhe da prova — plano de estudo, conteúdos (checklist) e sessões. */
export function ExamDetailPage() {
  const { id = '' } = useParams()
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)
  const exam = useExam(id)
  const addTopic = useAddTopic()
  const updateTopic = useUpdateTopic()
  const deleteTopic = useDeleteTopic()
  const [editing, setEditing] = useState(false)
  const [gradeOpen, setGradeOpen] = useState(false)
  const [newTopic, setNewTopic] = useState('')
  const examYear = Number(exam.data?.date.slice(0, 4) ?? today.slice(0, 4))
  const grades = useGrades(examYear)
  const [error, setError] = useState<string | null>(null)

  if (exam.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6 text-ink-faint" />
      </div>
    )
  }
  if (exam.isError) {
    return (
      <div className="safe-top pt-2">
        <Header title="Prova" />
        <EmptyState
          className="mt-6"
          title="Não encontrada"
          description={errorMessage(exam.error)}
          action={
            <Link to="/estudos" className="text-accent">
              Voltar
            </Link>
          }
        />
      </div>
    )
  }

  const e = exam.data
  const linkedGrade = grades.data?.subjects.flatMap((s) => s.periods.flatMap((p) => p.grades)).find((g) => g.exam_id === e.id) ?? null
  const canGrade = e.subject_id !== null && (e.date <= today || e.status === 'done')
  const todaySession = e.sessions.find((s) => s.date === today)
  const canStudyToday = e.status === 'open' && (todaySession !== undefined || e.date > today)
  const pct = e.sessions_total ? Math.round((e.sessions_done * 100) / e.sessions_total) : 0

  async function submitTopic(ev: FormEvent) {
    ev.preventDefault()
    const title = newTopic.trim()
    if (!title) return
    try {
      await addTopic.mutateAsync({ examId: e.id, title })
      setNewTopic('')
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="safe-top pt-2 pb-10">
      <Header title={examKindLabel[e.kind]} onEdit={() => setEditing(true)} />

      <Card className="mt-3">
        <div className="flex items-start gap-3">
          <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: e.subject_color ?? '#9CA3AF' }} aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">{e.title}</h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              {e.subject_name ? `${e.subject_name} · ` : ''}
              {examDateLabel(e.date, today)} ·{' '}
              <span className={cn(e.days_until >= 0 && e.days_until <= 2 && e.status === 'open' && 'font-semibold text-accent')}>
                {describeDaysUntil(e.days_until)}
              </span>
              {e.status === 'done' && <span className="text-accent"> · {e.kind === 'exam' ? 'feita' : 'entregue'}</span>}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <span className="tabular shrink-0 text-[13px] text-ink-muted">
            {e.sessions_done}/{e.sessions_total} {e.sessions_total === 1 ? 'sessão' : 'sessões'}
          </span>
        </div>
        <p className="mt-2 text-[13px] text-ink-faint">
          {fmtMinutes(e.minutes_per_day)} por dia · cobra a partir de {relativeDay(e.study_from, today)} · {e.lead_days} dias antes
        </p>
        {e.notes && <p className="mt-3 text-[14px] leading-relaxed whitespace-pre-line text-ink-muted">{e.notes}</p>}
        {canGrade && (
          <button
            type="button"
            onClick={() => setGradeOpen(true)}
            className="mt-4 flex w-full items-center justify-between rounded-lg border border-line bg-elevated px-4 py-3 text-left transition-colors hover:bg-white/8"
          >
            <span className="text-[15px]">{linkedGrade ? 'Nota lançada' : 'Lançar a nota'}</span>
            <span className={cn('tabular text-[18px] font-semibold', linkedGrade ? 'text-accent' : 'text-ink-faint')}>
              {linkedGrade ? fmtGrade(linkedGrade.value) : '—'}
            </span>
          </button>
        )}
        {canStudyToday && (
          <Link to={`/estudos/${e.id}/sessao/${today}`} className="mt-4 block">
            <Button size="lg" full variant={todaySession?.status === 'completed' ? 'secondary' : 'primary'}>
              {todaySession?.status === 'completed'
                ? 'Sessão de hoje concluída · ver'
                : todaySession?.status === 'in_progress'
                  ? 'Continuar sessão de hoje'
                  : todaySession
                    ? 'Estudar agora'
                    : 'Estudar hoje (extra)'}
            </Button>
          </Link>
        )}
      </Card>

      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between px-0.5">
          <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Conteúdos</h2>
          {e.topics_total > 0 && (
            <span className={cn('tabular text-[12px]', e.topics_done === e.topics_total ? 'text-accent' : 'text-ink-muted')}>
              {e.topics_done}/{e.topics_total}
            </span>
          )}
        </div>
        {e.topics.length === 0 ? (
          <p className="px-0.5 pb-2 text-[13px] text-ink-faint">
            Liste o que cai. Marcar cada conteúdo mostra o que falta e orienta a IA logo abaixo.
          </p>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <ul className="divide-y divide-line">
              {e.topics.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-1.5 pr-2 pl-4">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-1 select-none">
                    <Checkbox
                      label={t.title}
                      checked={t.is_done}
                      disabled={updateTopic.isPending}
                      onChange={(v) =>
                        updateTopic.mutate({ examId: e.id, id: t.id, is_done: v }, { onError: (err) => setError(errorMessage(err)) })
                      }
                    />
                    <span className={cn('min-w-0 flex-1 text-[15px]', t.is_done && 'text-ink-faint line-through')}>{t.title}</span>
                  </label>
                  <button
                    type="button"
                    aria-label={`Excluir conteúdo ${t.title}`}
                    onClick={() => deleteTopic.mutate({ examId: e.id, id: t.id }, { onError: (err) => setError(errorMessage(err)) })}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-white/5 hover:text-danger"
                  >
                    <svg
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <form onSubmit={submitTopic} className="mt-2 flex items-end gap-2" noValidate>
          <Field
            label="Novo conteúdo"
            value={newTopic}
            onChange={(ev) => setNewTopic(ev.target.value)}
            maxLength={120}
            placeholder="Ex.: Equações de 2º grau"
            className="flex-1"
          />
          <Button type="submit" loading={addTopic.isPending} disabled={!newTopic.trim()} className="h-12">
            Adicionar
          </Button>
        </form>
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      </section>

      <AISection examId={e.id} />

      <section className="mt-6">
        <h2 className="mb-2 px-0.5 text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Sessões de estudo</h2>
        {e.sessions.length === 0 ? (
          <p className="px-0.5 text-[13px] text-ink-faint">
            {e.status === 'done' ? 'Nenhuma sessão registrada.' : 'A data é hoje ou já passou: sem sessões planejadas.'}
          </p>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <ol className="divide-y divide-line">
              {e.sessions.map((s) => (
                <SessionHistoryRow key={s.date} s={s} today={today} examId={e.id} open={e.status === 'open'} />
              ))}
            </ol>
          </Card>
        )}
      </section>

      <ExamSheet open={editing} exam={e} onClose={() => setEditing(false)} />
      {e.subject_id && (
        <GradeSheet
          open={gradeOpen}
          onClose={() => setGradeOpen(false)}
          subjectId={e.subject_id}
          subjectName={e.subject_name ?? ''}
          year={examYear}
          grade={linkedGrade ?? undefined}
          exam={{ id: e.id, title: e.title }}
        />
      )}
    </div>
  )
}

function SessionHistoryRow({ s, today, examId, open }: { s: StudySession; today: string; examId: string; open: boolean }) {
  const isToday = s.date === today
  const isPast = s.date < today
  const done = s.status === 'completed'
  const missed = isPast && !done
  const label = relativeDay(s.date, today)
  const status = done
    ? `${sessionStatusLabel(s)} · ${fmtFocus(s.focused_seconds)}`
    : missed
      ? s.status === 'skipped'
        ? 'Pulada'
        : 'Não feita'
      : isToday
        ? sessionStatusLabel(s)
        : fmtMinutes(s.planned_minutes)
  const content = (
    <>
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full border',
          done
            ? 'border-accent bg-accent text-on-accent'
            : missed
              ? 'border-danger/50 text-transparent'
              : 'border-line-strong text-transparent',
        )}
      >
        <svg
          className="size-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 text-[15px] first-letter:uppercase',
          isToday && 'font-semibold',
          !isToday && !done && 'text-ink-muted',
        )}
      >
        {label}
      </span>
      <span className={cn('shrink-0 text-[12px]', done ? 'text-accent' : missed ? 'text-danger' : 'text-ink-faint')}>{status}</span>
    </>
  )
  const className = 'flex items-center gap-3 px-4 py-2.5'
  return (
    <li>
      {isToday && open ? (
        <Link to={`/estudos/${examId}/sessao/${s.date}`} className={cn(className, 'transition-colors hover:bg-elevated')}>
          {content}
        </Link>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  )
}

function Header({ title, onEdit }: { title: string; onEdit?: () => void }) {
  return (
    <header className="flex h-12 items-center gap-3">
      <Link
        to="/estudos"
        aria-label="Voltar"
        className="-ml-2 flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink"
      >
        <svg
          className="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold tracking-[-0.02em]">{title}</h1>
      {onEdit && (
        <button type="button" onClick={onEdit} className="text-[13px] font-semibold text-accent">
          Editar
        </button>
      )}
    </header>
  )
}
