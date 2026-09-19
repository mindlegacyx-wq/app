import { useState, type FormEvent } from 'react'

import { Button, Dialog, Field, Sheet, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/format'
import type { TaskCategory } from '@/lib/types'

import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from './api'

/** Paleta fixa: cores distinguíveis entre si e legíveis no fundo escuro. */
export const CATEGORY_COLORS = ['#4F8CFF', '#22C7A9', '#F5B942', '#FF7A59', '#C084FC', '#F472B6', '#9AA3AF', '#C6F135'] as const

/** Tela 7: criar, renomear, recolorir e excluir categorias. */
export function CategoriesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Categorias">
      <CategoriesBody />
    </Sheet>
  )
}

function CategoriesBody() {
  const cats = useCategories()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0])
  const [editing, setEditing] = useState<TaskCategory | null>(null)
  const [toDelete, setToDelete] = useState<TaskCategory | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, name: name.trim(), color })
        setEditing(null)
      } else {
        await create.mutateAsync({ name: name.trim(), color })
      }
      setName('')
      setColor(CATEGORY_COLORS[(cats.data?.length ?? 0) % CATEGORY_COLORS.length] ?? CATEGORY_COLORS[0])
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  function startEdit(c: TaskCategory) {
    setEditing(c)
    setName(c.name)
    setColor(c.color)
  }

  return (
    <div className="flex flex-col gap-5">
      {cats.isPending ? (
        <div className="flex justify-center py-4">
          <Spinner className="size-5 text-ink-faint" />
        </div>
      ) : (cats.data?.length ?? 0) === 0 ? (
        <p className="text-[14px] text-ink-muted">Nenhuma categoria ainda. Crie a primeira abaixo.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {cats.data!.map((c) => (
            <li key={c.id} className={cn('flex items-center gap-3 px-3 py-2.5', editing?.id === c.id && 'bg-white/4')}>
              <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
              <button type="button" onClick={() => startEdit(c)} className="min-w-0 flex-1 truncate text-left text-[15px]">
                {c.name}
              </button>
              <button
                type="button"
                aria-label={`Excluir categoria ${c.name}`}
                onClick={() => setToDelete(c)}
                className="flex size-9 items-center justify-center rounded-full text-ink-faint hover:bg-white/5 hover:text-danger"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-line-strong bg-elevated p-3" noValidate>
        <p className="text-[13px] font-medium text-ink-muted">{editing ? `Editando "${editing.name}"` : 'Nova categoria'}</p>
        <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder="Ex.: Trabalho" />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-muted">Cor</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor da categoria">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn('size-8 rounded-full border-2 transition-transform', color === c ? 'scale-110 border-ink' : 'border-transparent')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <div className="flex gap-2">
          {editing && (
            <Button type="button" variant="secondary" full onClick={() => { setEditing(null); setName('') }}>
              Cancelar
            </Button>
          )}
          <Button type="submit" full loading={create.isPending || update.isPending} disabled={!name.trim()}>
            {editing ? 'Salvar' : 'Adicionar'}
          </Button>
        </div>
      </form>

      <Dialog
        open={toDelete !== null}
        title="Excluir categoria?"
        description={toDelete ? `As tarefas de "${toDelete.name}" continuam, só sem categoria.` : undefined}
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              if (editing?.id === toDelete.id) { setEditing(null); setName('') }
              setToDelete(null)
            },
            onError: (e) => setError(errorMessage(e)),
          })
        }
      />
    </div>
  )
}
