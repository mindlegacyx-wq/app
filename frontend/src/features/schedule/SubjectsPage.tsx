import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Button, Card, Dialog, EmptyState, Fab, Field, Sheet, Spinner, Toggle } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn, pluralize } from '@/lib/format'
import type { Subject } from '@/lib/types'

import { useCreateSubject, useDeleteSubject, useScheduleWeek, useSubjects, useUpdateSubject } from './api'
import { SUBJECT_COLORS, fmtDuration } from './shared'

/** Tela 31: matérias (nome, cor, professor), com carga semanal calculada pela agenda. */
export function SubjectsPage() {
  const subjects = useSubjects()
  const week = useScheduleWeek()
  const [sheet, setSheet] = useState<{ open: boolean; subject?: Subject }>({
    open: false,
  })

  // Minutos por semana de cada matéria, somando os blocos ativos.
  const load = new Map<string, { blocks: number; minutes: number }>()
  for (const d of week.data?.days ?? []) {
    for (const b of d.blocks) {
      if (!b.subject_id || !b.is_active) continue
      const cur = load.get(b.subject_id) ?? { blocks: 0, minutes: 0 }
      load.set(b.subject_id, {
        blocks: cur.blocks + 1,
        minutes: cur.minutes + b.duration_minutes,
      })
    }
  }

  return (
    <div className="safe-top pt-2 pb-28">
      <header className="flex h-12 items-center gap-3">
        <Link
          to="/agenda"
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
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold tracking-[-0.02em]">Matérias</h1>
      </header>

      {subjects.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : subjects.isError ? (
        <EmptyState className="mt-6" title="Não foi possível carregar" description={errorMessage(subjects.error)} />
      ) : subjects.data.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="Nenhuma matéria"
          description="Cada matéria tem uma cor na agenda e recebe as notas e as provas."
          action={<Button onClick={() => setSheet({ open: true })}>Criar a primeira matéria</Button>}
        />
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {subjects.data.map((s) => {
            const l = load.get(s.id)
            return (
              <li key={s.id}>
                <button type="button" onClick={() => setSheet({ open: true, subject: s })} className="block w-full text-left">
                  <Card className={cn('flex items-center gap-3 transition-colors hover:bg-elevated', !s.is_active && 'opacity-55')}>
                    <span className="size-3.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{s.name}</span>
                      <span className="block truncate text-[12px] text-ink-faint">
                        {s.teacher ? `${s.teacher} · ` : ''}
                        {l ? `${pluralize(l.blocks, 'aula', 'aulas')}/semana · ${fmtDuration(l.minutes)}` : 'sem aulas na agenda'}
                        {!s.is_active && ' · arquivada'}
                      </span>
                    </span>
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
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Fab label="Nova matéria" onClick={() => setSheet({ open: true })} />
      <SubjectSheet open={sheet.open} subject={sheet.subject} onClose={() => setSheet({ open: false })} />
    </div>
  )
}

function SubjectSheet({ open, subject, onClose }: { open: boolean; subject?: Subject; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={subject ? 'Editar matéria' : 'Nova matéria'}>
      <SubjectForm key={subject?.id ?? 'new'} subject={subject} onClose={onClose} />
    </Sheet>
  )
}

function SubjectForm({ subject, onClose }: { subject?: Subject; onClose: () => void }) {
  const all = useSubjects()
  const create = useCreateSubject()
  const update = useUpdateSubject()
  const remove = useDeleteSubject()
  const [name, setName] = useState(subject?.name ?? '')
  const [teacher, setTeacher] = useState(subject?.teacher ?? '')
  const [color, setColor] = useState(subject?.color ?? SUBJECT_COLORS[(all.data?.length ?? 0) % SUBJECT_COLORS.length]!)
  const [active, setActive] = useState(subject?.is_active ?? true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (subject) {
        await update.mutateAsync({
          id: subject.id,
          name: name.trim(),
          color,
          teacher: teacher.trim() || null,
          clear_teacher: teacher.trim() === '',
          is_active: active,
        })
      } else {
        await create.mutateAsync({
          name: name.trim(),
          color,
          teacher: teacher.trim() || null,
        })
      }
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field
        label="Nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        required
        autoFocus={!subject}
        placeholder="Ex.: Matemática"
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Cor</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor da matéria">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn(
                'size-9 rounded-full border-2 transition-transform',
                color === c ? 'scale-110 border-ink' : 'border-transparent',
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <Field
        label="Professor(a) (opcional)"
        value={teacher}
        onChange={(e) => setTeacher(e.target.value)}
        maxLength={60}
        placeholder="Ex.: Prof. Ana"
      />
      {subject && (
        <div className="flex items-center justify-between rounded-lg border border-line px-4 py-3">
          <div>
            <p className="text-[15px]">Ativa</p>
            <p className="text-[12px] text-ink-faint">Arquivada some das opções, mas mantém as aulas e as notas.</p>
          </div>
          <Toggle checked={active} onChange={setActive} label="Matéria ativa" />
        </div>
      )}
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <Button type="submit" size="lg" full loading={create.isPending || update.isPending} disabled={!name.trim()}>
        {subject ? 'Salvar' : 'Criar matéria'}
      </Button>
      {subject && (
        <Button type="button" variant="ghost" full className="text-danger" onClick={() => setConfirmDelete(true)}>
          Excluir
        </Button>
      )}
      <Dialog
        open={confirmDelete}
        title="Excluir matéria?"
        description={subject ? `As aulas de "${subject.name}" continuam na agenda, só sem a matéria. Fica 30 dias na lixeira.` : undefined}
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          subject &&
          remove.mutate(subject.id, {
            onSuccess: () => {
              setConfirmDelete(false)
              onClose()
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
