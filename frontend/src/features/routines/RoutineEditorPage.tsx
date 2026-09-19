import { Reorder, useDragControls } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Button, Card, Dialog, EmptyState, Field, Sheet, Spinner, Toggle } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn, describeDays, pluralize, shortTime } from '@/lib/format'
import type { RoutineItem } from '@/lib/types'

import { RoutineSheet } from './RoutineSheet'
import {
  useAddItem,
  useDeleteItem,
  useDeleteRoutine,
  useReorderItems,
  useRoutine,
  useUpdateItem,
  useUpdateRoutine,
} from './api'

/** Tela 10: nome, horário, dias e a lista ordenável de itens da rotina. */
export function RoutineEditorPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const routine = useRoutine(id)

  const [metaOpen, setMetaOpen] = useState(false)
  const [itemSheet, setItemSheet] = useState<{ open: boolean; item?: RoutineItem }>({ open: false })
  const [deleteItem, setDeleteItem] = useState<RoutineItem | null>(null)
  const [deleteRoutineOpen, setDeleteRoutineOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateRoutine = useUpdateRoutine(id)
  const removeRoutine = useDeleteRoutine()
  const removeItem = useDeleteItem()
  const reorder = useReorderItems(id)

  const items = routine.data?.items ?? []

  if (routine.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6 text-ink-faint" />
      </div>
    )
  }
  if (routine.isError || !routine.data) {
    return (
      <div className="safe-top pt-2">
        <Header title="Rotina" />
        <EmptyState className="mt-6" title="Rotina não encontrada" action={<Link to="/rotina" className="text-accent">Voltar</Link>} />
      </div>
    )
  }
  const r = routine.data

  return (
    <div className="safe-top pt-2">
      <Header title={r.name} />

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[14px] text-danger">
          {error}
        </p>
      )}

      <Card className="mt-3">
        <button type="button" onClick={() => setMetaOpen(true)} className="flex w-full items-start justify-between gap-3 text-left">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
              {r.kind === 'morning' ? 'Manhã' : r.kind === 'evening' ? 'Noite' : 'Bloco'}
            </p>
            <p className="mt-1 text-[15px] text-ink-muted first-letter:uppercase">{describeDays(r.days_of_week)}</p>
          </div>
          <div className="flex items-center gap-2">
            {r.start_time && <span className="tabular text-[22px] font-semibold">{shortTime(r.start_time)}</span>}
            <Chevron />
          </div>
        </button>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <div>
            <p className="text-[15px]">Rotina ativa</p>
            <p className="text-[13px] text-ink-faint">Pausada, não entra no dia nem no percentual.</p>
          </div>
          <Toggle
            label="Rotina ativa"
            checked={r.is_active}
            disabled={updateRoutine.isPending}
            onChange={(v) => updateRoutine.mutate({ is_active: v }, { onError: (e) => setError(errorMessage(e)) })}
          />
        </div>
      </Card>

      <div className="mt-7 flex items-baseline justify-between px-0.5">
        <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">
          Itens {items.length > 0 && `· ${pluralize(items.length, 'item', 'itens')}`}
        </h2>
        {items.length > 1 && <span className="text-[12px] text-ink-faint">Arraste pela alça para ordenar</span>}
      </div>

      {items.length === 0 ? (
        <EmptyState
          className="mt-2"
          title="Nenhum item ainda"
          description="Cada item vira um check na tela Hoje. Comece com dois ou três."
          action={<Button onClick={() => setItemSheet({ open: true })}>Adicionar item</Button>}
        />
      ) : (
        <ItemList
          // Remonta quando a ordem do servidor muda: estado local sempre parte da verdade.
          key={items.map((i) => i.id).join()}
          items={items}
          onEdit={(item) => setItemSheet({ open: true, item })}
          onDelete={setDeleteItem}
          onReorder={(ids) => reorder.mutate(ids, { onError: (e) => setError(errorMessage(e)) })}
        />
      )}

      {items.length > 0 && (
        <Button variant="secondary" full className="mt-3" onClick={() => setItemSheet({ open: true })}>
          + Adicionar item
        </Button>
      )}

      <div className="mt-10">
        <Button variant="ghost" full className="text-danger" onClick={() => setDeleteRoutineOpen(true)}>
          Excluir rotina
        </Button>
      </div>

      <RoutineSheet open={metaOpen} onClose={() => setMetaOpen(false)} routine={r} />
      <ItemSheet
        open={itemSheet.open}
        item={itemSheet.item}
        routineId={r.id}
        onClose={() => setItemSheet({ open: false })}
      />

      <Dialog
        open={deleteItem !== null}
        title="Excluir item?"
        description={deleteItem ? `"${deleteItem.title}" sai da rotina. O histórico de dias anteriores é mantido.` : undefined}
        confirmLabel="Excluir"
        danger
        loading={removeItem.isPending}
        onCancel={() => setDeleteItem(null)}
        onConfirm={() =>
          deleteItem &&
          removeItem.mutate(deleteItem.id, {
            onSuccess: () => setDeleteItem(null),
            onError: (e) => setError(errorMessage(e)),
          })
        }
      />
      <Dialog
        open={deleteRoutineOpen}
        title="Excluir rotina?"
        description="Ela vai para a lixeira por 30 dias. Os dias já registrados continuam no histórico."
        confirmLabel="Excluir"
        danger
        loading={removeRoutine.isPending}
        onCancel={() => setDeleteRoutineOpen(false)}
        onConfirm={() =>
          removeRoutine.mutate(r.id, {
            onSuccess: () => navigate('/rotina', { replace: true }),
            onError: (e) => setError(errorMessage(e)),
          })
        }
      />
    </div>
  )
}

function Header({ title }: { title: string }) {
  return (
    <header className="flex h-12 items-center gap-3">
      <Link to="/rotina" aria-label="Voltar" className="-ml-2 flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <h1 className="truncate text-[20px] font-semibold tracking-[-0.02em]">{title}</h1>
    </header>
  )
}

function Chevron() {
  return (
    <svg className="size-4 shrink-0 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

function ItemList({
  items,
  onEdit,
  onDelete,
  onReorder,
}: {
  items: RoutineItem[]
  onEdit: (item: RoutineItem) => void
  onDelete: (item: RoutineItem) => void
  onReorder: (ids: string[]) => void
}) {
  // Só a ORDEM fica local (para o arrastar ser fluido); os dados vêm sempre do servidor.
  const [orderIds, setOrderIds] = useState(() => items.map((i) => i.id))
  const byId = new Map(items.map((i) => [i.id, i]))
  return (
    <Reorder.Group axis="y" values={orderIds} onReorder={setOrderIds} className="mt-2 flex flex-col gap-2" as="ul">
      {orderIds.map((id) => {
        const item = byId.get(id)
        if (!item) return null
        return (
          <ItemRow
            key={item.id}
            item={item}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item)}
            onDrop={() => {
              if (orderIds.join() !== items.map((i) => i.id).join()) onReorder(orderIds)
            }}
          />
        )
      })}
    </Reorder.Group>
  )
}

function ItemRow({
  item,
  onEdit,
  onDelete,
  onDrop,
}: {
  item: RoutineItem
  onEdit: () => void
  onDelete: () => void
  onDrop: () => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={item.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="flex items-center gap-2 rounded-lg border border-line bg-surface pr-1 pl-2"
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px rgb(0 0 0 / 45%)', borderColor: 'rgb(255 255 255 / 20%)' }}
    >
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        onPointerDown={(e) => controls.start(e)}
        className="flex h-12 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-ink-faint active:cursor-grabbing"
      >
        <svg className="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <circle cx="5.5" cy="3.5" r="1.4" /><circle cx="10.5" cy="3.5" r="1.4" />
          <circle cx="5.5" cy="8" r="1.4" /><circle cx="10.5" cy="8" r="1.4" />
          <circle cx="5.5" cy="12.5" r="1.4" /><circle cx="10.5" cy="12.5" r="1.4" />
        </svg>
      </button>
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left">
        <span className="min-w-0 flex-1 truncate text-[15px]">{item.title}</span>
        {item.duration_minutes && <span className="tabular shrink-0 text-[13px] text-ink-faint">{item.duration_minutes} min</span>}
      </button>
      <button
        type="button"
        aria-label={`Excluir ${item.title}`}
        onClick={onDelete}
        className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-white/5 hover:text-danger')}
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </svg>
      </button>
    </Reorder.Item>
  )
}

function ItemSheet({
  open,
  item,
  routineId,
  onClose,
}: {
  open: boolean
  item?: RoutineItem
  routineId: string
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Editar item' : 'Novo item'}>
      <ItemForm item={item} routineId={routineId} onClose={onClose} />
    </Sheet>
  )
}

function ItemForm({ item, routineId, onClose }: { item?: RoutineItem; routineId: string; onClose: () => void }) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [duration, setDuration] = useState(item?.duration_minutes ? String(item.duration_minutes) : '')
  const [error, setError] = useState<string | null>(null)
  const add = useAddItem(routineId)
  const update = useUpdateItem()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body = { title: title.trim(), duration_minutes: duration ? Number(duration) : null }
    try {
      if (item) await update.mutateAsync({ id: item.id, ...body })
      else await add.mutateAsync(body)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field
        label="O que fazer"
        placeholder="Ex.: Beber 500 ml de água"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        required
        autoFocus
      />
      <Field
        label="Duração (opcional)"
        type="number"
        inputMode="numeric"
        min={1}
        max={600}
        placeholder="minutos"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        className="[&_input]:tabular"
      />
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <Button type="submit" size="lg" full loading={add.isPending || update.isPending} disabled={!title.trim()}>
        {item ? 'Salvar' : 'Adicionar'}
      </Button>
    </form>
  )
}
