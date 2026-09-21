import { useState, type FormEvent } from 'react'

import { Button, Chip, Dialog, Field, Sheet } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import type { Grade } from '@/lib/types'

import { useCreateGrade, useDeleteGrade, useUpdateGrade } from './api'
import { fmtGrade, parseGrade, periodLabel } from './shared'

interface Props {
  open: boolean
  onClose: () => void
  subjectId: string
  subjectName: string
  year: number
  /** Período sugerido ao criar. */
  period?: number
  grade?: Grade
  /** Ao lançar a nota de uma prova: liga e usa o título dela. */
  exam?: { id: string; title: string }
}

/** Tela 37: lançar/editar uma nota — período, título, valor, peso. */
export function GradeSheet({ open, onClose, subjectId, subjectName, year, period, grade, exam }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={grade ? 'Editar nota' : `Nota · ${subjectName}`}>
      <GradeForm
        key={grade?.id ?? `new-${period ?? 0}-${exam?.id ?? ''}`}
        subjectId={subjectId}
        year={year}
        period={period}
        grade={grade}
        exam={exam}
        onClose={onClose}
      />
    </Sheet>
  )
}

function GradeForm({ subjectId, year, period, grade, exam, onClose }: Omit<Props, 'open' | 'subjectName'>) {
  const settings = useAuth((s) => s.user!.settings)
  const create = useCreateGrade()
  const update = useUpdateGrade()
  const remove = useDeleteGrade()
  const [p, setP] = useState(grade?.period ?? period ?? 1)
  const [title, setTitle] = useState(grade?.title ?? exam?.title ?? '')
  const [value, setValue] = useState(grade ? fmtGrade(grade.value) : '')
  const [weight, setWeight] = useState(grade?.weight ?? 1)
  // Na soma de pontos, o que importa é quanto a avaliação valia (prova 6 + trabalho 4).
  const sumMode = settings.grade_mode === 'sum'
  const [points, setPoints] = useState(grade?.max_points != null ? fmtGrade(grade.max_points) : '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = parseGrade(value)
  const parsedPoints = points.trim() === '' ? null : parseGrade(points)
  const invalid =
    (value.trim() !== '' && (parsed === null || parsed < 0 || parsed > settings.grade_max)) ||
    (parsed !== null && parsedPoints !== null && parsed > parsedPoints)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (parsed === null) return setError('Informe a nota.')
    if (parsed < 0 || parsed > settings.grade_max) return setError(`A nota vai de 0 a ${fmtGrade(settings.grade_max)}.`)
    if (parsedPoints !== null && parsed > parsedPoints)
      return setError(`A nota não passa dos ${fmtGrade(parsedPoints)} pontos da avaliação.`)
    try {
      if (grade) {
        await update.mutateAsync({
          id: grade.id,
          period: p,
          title: title.trim() || null,
          clear_title: title.trim() === '',
          value: parsed,
          weight: sumMode ? 1 : weight,
          max_points: sumMode ? parsedPoints : undefined,
          clear_max_points: sumMode && parsedPoints === null,
        })
      } else {
        await create.mutateAsync({
          subject_id: subjectId,
          year,
          period: p,
          title: title.trim() || null,
          value: parsed,
          weight: sumMode ? 1 : weight,
          max_points: sumMode ? parsedPoints : null,
          exam_id: exam?.id ?? null,
        })
      }
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Período</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Período">
          {Array.from({ length: settings.periods_per_year }, (_, i) => i + 1).map((n) => (
            <Chip key={n} active={p === n} onClick={() => setP(n)}>
              {periodLabel(n, settings.periods_per_year)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field
          label={`Nota (0 a ${fmtGrade(settings.grade_max)})`}
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={settings.grade_max >= 100 ? 'Ex.: 75' : 'Ex.: 7,5'}
          error={invalid ? `Entre 0 e ${fmtGrade(settings.grade_max)}` : undefined}
          className="[&_input]:tabular [&_input]:text-[22px] [&_input]:font-semibold"
          autoFocus={!grade}
          required
        />
        {sumMode ? (
          <Field
            label="Valia"
            inputMode="decimal"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="Ex.: 6"
            className="w-24 [&_input]:tabular [&_input]:text-[22px] [&_input]:font-semibold"
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-muted">Peso</span>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Peso">
              {[1, 2, 3].map((w) => (
                <Chip key={w} active={weight === w} onClick={() => setWeight(w)} className="h-12 px-3.5">
                  {w}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="-mt-3 text-[12px] text-ink-faint">
        {sumMode
          ? 'Quanto a avaliação valia. A nota do trimestre é a soma do que você tirou em cada uma.'
          : 'O peso decide quanto a avaliação pesa na média do trimestre.'}
      </p>

      <Field
        label="Título (opcional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={60}
        placeholder="Ex.: Prova 1 · Trabalho · Participação"
      />

      {error && <p className="text-[14px] text-danger">{error}</p>}

      <Button type="submit" size="lg" full loading={create.isPending || update.isPending} disabled={parsed === null || invalid}>
        {grade ? 'Salvar' : 'Lançar nota'}
      </Button>

      {grade && (
        <Button type="button" variant="ghost" full className="text-danger" onClick={() => setConfirmDelete(true)}>
          Excluir nota
        </Button>
      )}

      <Dialog
        open={confirmDelete}
        title="Excluir esta nota?"
        description="A média do período é recalculada na hora."
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          grade &&
          remove.mutate(grade.id, {
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
