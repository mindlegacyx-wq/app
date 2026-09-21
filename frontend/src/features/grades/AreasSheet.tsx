import { AnimatePresence, m } from 'motion/react'
import { useState, type FormEvent } from 'react'

import { Button, Card, Field, Sheet, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { pluralize } from '@/lib/format'
import type { GradeArea } from '@/lib/types'

import { useCreateArea, useDeleteArea, useGradeAreas, useSetSubjectGradeSettings, useUpdateArea } from './api'

interface Props {
  open: boolean
  onClose: () => void
  subjects: { subject_id: string; name: string; color: string; area_id: string | null }[]
}

/**
 * Gerenciar áreas: criar, renomear, excluir e dizer quais matérias entram em cada uma.
 * Excluir a área não apaga matéria nenhuma — elas só ficam sem área.
 */
export function AreasSheet({ open, onClose, subjects }: Props) {
  const areas = useGradeAreas()
  const create = useCreateArea()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return
    try {
      await create.mutateAsync({ name: name.trim() })
      setName('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Áreas de conhecimento">
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-ink-faint">
          A nota da área é a média das notas das matérias dela. Toque no × para tirar uma matéria; em "+ Adicionar
          matéria" para colocar.
        </p>

        {areas.isPending ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-5 text-ink-faint" />
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {areas.data?.map((area) => (
              <m.div key={area.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <AreaRow area={area} subjects={subjects} onError={setError} />
              </m.div>
            ))}
          </AnimatePresence>
        )}

        <form onSubmit={add} className="flex items-end gap-2">
          <Field
            label="Nova área"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Ex.: Técnico"
            className="flex-1"
          />
          <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
            Criar
          </Button>
        </form>

        {error && <p className="text-[14px] text-danger">{error}</p>}
      </div>
    </Sheet>
  )
}

function AreaRow({
  area,
  subjects,
  onError,
}: {
  area: GradeArea
  subjects: Props['subjects']
  onError: (m: string | null) => void
}) {
  const update = useUpdateArea()
  const remove = useDeleteArea()
  const assign = useSetSubjectGradeSettings()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState(area.name)

  const mine = subjects.filter((s) => s.area_id === area.id)
  // Para adicionar: primeiro as que não têm área, depois as que estão em outra.
  const others = subjects
    .filter((s) => s.area_id !== area.id)
    .sort((a, b) => Number(Boolean(a.area_id)) - Number(Boolean(b.area_id)))

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="size-3 shrink-0 rounded-full" style={{ background: area.color }} aria-hidden />
        {editing ? (
          <input
            autoFocus
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditing(false)
              if (name.trim() && name.trim() !== area.name) {
                update.mutate({ id: area.id, name: name.trim() }, { onError: (e) => onError(errorMessage(e)) })
              } else {
                setName(area.name)
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="min-w-0 flex-1 rounded-md border border-accent bg-surface px-2 py-1 text-[15px] font-semibold outline-none"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="min-w-0 flex-1 truncate text-left text-[15px] font-semibold">
            {area.name}
          </button>
        )}
        <span className="shrink-0 text-[12px] text-ink-faint">{pluralize(mine.length, 'matéria', 'matérias')}</span>
        <button
          type="button"
          aria-label={`Excluir ${area.name}`}
          onClick={() => remove.mutate(area.id, { onError: (e) => onError(errorMessage(e)) })}
          className="shrink-0 p-1 text-ink-faint active:text-danger"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {mine.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {mine.map((s) => (
            <li key={s.subject_id}>
              <button
                type="button"
                aria-label={`Tirar ${s.name} de ${area.name}`}
                onClick={() =>
                  assign.mutate({ id: s.subject_id, clear_area: true }, { onError: (e) => onError(errorMessage(e)) })
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-2.5 text-[12px] font-medium text-accent"
              >
                <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
                {s.name}
                <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 &&
        (adding ? (
          <ul className="flex flex-wrap gap-1.5 border-t border-line pt-3">
            {others.map((s) => (
              <li key={s.subject_id}>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false)
                    assign.mutate({ id: s.subject_id, area_id: area.id }, { onError: (e) => onError(errorMessage(e)) })
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[12px] font-medium text-ink-muted"
                >
                  <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
                  {s.name}
                  {s.area_id && <span className="text-ink-faint">· troca de área</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="self-start text-[13px] font-semibold text-accent">
            + Adicionar matéria
          </button>
        ))}

    </Card>
  )
}
