import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { Button, Chip, Dialog, Field, Sheet, Spinner } from '@/components/ui'
import { useSubjects } from '@/features/schedule/api'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { addDays, cn, todayIn } from '@/lib/format'
import type { Exam, ExamKind } from '@/lib/types'

import { useCreateExam, useDeleteExam, useUpdateExam } from './api'
import { LEAD_DAYS_OPTIONS, MINUTES_OPTIONS, examKindLabel, fmtMinutes } from './shared'

interface Props {
  open: boolean
  onClose: () => void
  exam?: Exam
}

/** Tela 33: nova prova/trabalho — data, quando começar a cobrar e quanto estudar por dia. */
export function ExamSheet({ open, onClose, exam }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={exam ? 'Editar' : 'Nova prova ou trabalho'}>
      <ExamForm key={exam?.id ?? 'new'} exam={exam} onClose={onClose} />
    </Sheet>
  )
}

function ExamForm({ exam, onClose }: { exam?: Exam; onClose: () => void }) {
  const user = useAuth((s) => s.user)!
  const today = todayIn(user.timezone)
  const navigate = useNavigate()
  const subjects = useSubjects()
  const create = useCreateExam()
  const update = useUpdateExam()
  const remove = useDeleteExam()

  const [kind, setKind] = useState<ExamKind>(exam?.kind ?? 'exam')
  const [title, setTitle] = useState(exam?.title ?? '')
  const [subjectId, setSubjectId] = useState<string | null>(exam?.subject_id ?? null)
  const [date, setDate] = useState(exam?.date ?? addDays(today, 7))
  const [leadDays, setLeadDays] = useState(exam?.lead_days ?? 7)
  const [minutes, setMinutes] = useState(exam?.minutes_per_day ?? 30)
  const [notes, setNotes] = useState(exam?.notes ?? '')
  const [topics, setTopics] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeSubjects = (subjects.data ?? []).filter((s) => s.is_active || s.id === subjectId)
  const daysUntil = date ? Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000) : 0
  const sessions = Math.max(0, Math.min(leadDays, daysUntil))

  function pickSubject(id: string | null) {
    const prev = activeSubjects.find((s) => s.id === subjectId)
    const next = activeSubjects.find((s) => s.id === id)
    setSubjectId(id)
    const auto = (n: string) => `${examKindLabel[kind]} de ${n}`
    if (next && (!title.trim() || (prev && title === auto(prev.name)))) setTitle(auto(next.name))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!date) return setError('Informe a data.')
    if (!exam && date < today) return setError('A data já passou.')
    const base = {
      title: title.trim(),
      kind,
      subject_id: subjectId,
      date,
      lead_days: leadDays,
      minutes_per_day: minutes,
      notes: notes.trim() || null,
    }
    try {
      if (exam) {
        await update.mutateAsync({ id: exam.id, ...base, clear_subject: subjectId === null, clear_notes: base.notes === null })
        onClose()
      } else {
        const created = await create.mutateAsync({
          ...base,
          topics: topics
            .split('\n')
            .map((t) => t.trim())
            .filter(Boolean),
        })
        onClose()
        navigate(`/estudos/${created.id}`)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo">
        {(['exam', 'assignment'] as ExamKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              'h-10 rounded-sm border text-[14px] font-semibold transition-colors',
              kind === k ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-elevated text-ink-muted hover:text-ink',
            )}
          >
            {examKindLabel[k]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Matéria</span>
        {subjects.isPending ? (
          <Spinner className="size-4 text-ink-faint" />
        ) : activeSubjects.length === 0 ? (
          <p className="text-[13px] text-ink-faint">Nenhuma matéria ainda — crie em Rotina → Agenda → Matérias. Dá para seguir sem.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Chip active={subjectId === null} onClick={() => pickSubject(null)}>
              Sem matéria
            </Chip>
            {activeSubjects.map((s) => (
              <Chip key={s.id} active={subjectId === s.id} onClick={() => pickSubject(s.id)}>
                <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
                {s.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <Field
        label="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        required
        placeholder={kind === 'exam' ? 'Ex.: Prova de Matemática' : 'Ex.: Trabalho de História'}
      />

      <Field
        label={kind === 'exam' ? 'Data da prova' : 'Data de entrega'}
        type="date"
        value={date}
        min={exam ? undefined : today}
        onChange={(e) => setDate(e.target.value)}
        className="[&_input]:tabular"
        required
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Começar a cobrar</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Dias antes">
          {LEAD_DAYS_OPTIONS.map((d) => (
            <Chip key={d} active={leadDays === d} onClick={() => setLeadDays(d)}>
              {d} dias antes
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Estudo por dia</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Minutos por dia">
          {MINUTES_OPTIONS.map((m) => (
            <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)}>
              {fmtMinutes(m)}
            </Chip>
          ))}
        </div>
        <p className="text-[13px] text-ink-faint">
          {sessions === 0
            ? 'Nenhuma sessão: a data é hoje ou já passou.'
            : `${sessions} ${sessions === 1 ? 'sessão' : 'sessões'} de ${fmtMinutes(minutes)} · ${fmtMinutes(sessions * minutes)} no total. Cada sessão entra no percentual do dia.`}
        </p>
      </div>

      {!exam && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="exam-topics" className="text-[13px] font-medium text-ink-muted">
            Conteúdos (opcional, um por linha)
          </label>
          <textarea
            id="exam-topics"
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            rows={3}
            placeholder={'Frações\nEquações de 1º grau\nPotências'}
            className="w-full resize-none rounded-md border border-line-strong bg-elevated px-4 py-3 text-[15px] outline-none placeholder:text-ink-faint focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="exam-notes" className="text-[13px] font-medium text-ink-muted">
          Notas (opcional)
        </label>
        <textarea
          id="exam-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Capítulos, formato da prova, o que o professor avisou…"
          className="w-full resize-none rounded-md border border-line-strong bg-elevated px-4 py-3 text-[15px] outline-none placeholder:text-ink-faint focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {error && <p className="text-[14px] text-danger">{error}</p>}

      <Button type="submit" size="lg" full loading={create.isPending || update.isPending} disabled={!title.trim() || !date}>
        {exam ? 'Salvar' : 'Criar'}
      </Button>

      {exam && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            full
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { id: exam.id, status: exam.status === 'done' ? 'open' : 'done' },
                { onSuccess: onClose, onError: (e) => setError(errorMessage(e)) },
              )
            }
          >
            {exam.status === 'done' ? 'Reabrir' : kind === 'exam' ? 'Marcar como feita' : 'Marcar como entregue'}
          </Button>
          <Button type="button" variant="ghost" full className="text-danger" onClick={() => setConfirmDelete(true)}>
            Excluir
          </Button>
        </div>
      )}

      <Dialog
        open={confirmDelete}
        title="Excluir?"
        description={
          exam
            ? `"${exam.title}" e os conteúdos vão para a lixeira por 30 dias. As sessões já feitas continuam contando nos dias fechados.`
            : undefined
        }
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          exam &&
          remove.mutate(exam.id, {
            onSuccess: () => {
              setConfirmDelete(false)
              onClose()
              navigate('/estudos')
            },
            onError: (e) => {
              setConfirmDelete(false)
              setError(errorMessage(e))
            },
          })
        }
      />
    </form>
  )
}
