import { AnimatePresence, m, Reorder, useDragControls, type DragControls } from 'motion/react'
import { useRef, useState, type FormEvent, type RefObject } from 'react'

import { Dialog, Sheet } from '@/components/ui'
import { CountUp } from '@/components/ui/CountUp'
import { errorMessage } from '@/lib/api'
import { cn, pluralize } from '@/lib/format'
import { buzz } from '@/lib/sound'
import type { AreaGrades, GradesSummary, SubjectGrades } from '@/lib/types'

import {
  useCreateArea,
  useDeleteArea,
  useReorderAreas,
  useSetAreaSubjects,
  useSetSubjectGradeSettings,
  useUpdateArea,
} from './api'
import { decimalsOf, fmtGrade, fmtScore, periodLabel } from './shared'

interface Props {
  data: GradesSummary
  period: number
  onOpenSubject: (s: SubjectGrades) => void
}

const SPRING = { type: 'spring', stiffness: 420, damping: 34 } as const
const EASE = [0.25, 1, 0.5, 1] as const

/**
 * A tela de notas quando o usuário estuda por área.
 *
 * Três gestos, cada um com um só significado:
 * - **alça ⠿** ordena (as áreas entre si e as matérias dentro da área), igual aos treinos;
 * - **+ Adicionar matéria**, dentro da área, marca várias de uma vez;
 * - **tocar na matéria** abre as notas dela — ou, se ela ainda não tem área, a lista de áreas.
 *
 * A versão anterior pedia para arrastar cada matéria lá de cima até a área, o que com vinte
 * matérias virava mira de precisão. Tudo aqui responde na hora (atualização otimista).
 */
export function AreaBoard({ data, period, onOpenSubject }: Props) {
  const reorderAreas = useReorderAreas()
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState<SubjectGrades | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)

  const loose = data.subjects.filter((s) => !s.area_id)
  const [areaOrder, setAreaOrder] = useSyncedOrder(data.areas.map((a) => a.id))
  // O cartão arrastado não sai da coluna de áreas: sobe e desce, e só.
  const areasRef = useRef<HTMLDivElement>(null)
  const areasById = new Map(data.areas.map((a) => [a.id, a]))

  function dropArea() {
    if (areaOrder.join() !== data.areas.map((a) => a.id).join()) {
      reorderAreas.mutate(areaOrder, { onError: (e) => setError(errorMessage(e)) })
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {loose.length > 0 && (
          <LooseStrip key="soltas" subjects={loose} hasAreas={data.areas.length > 0} onPick={setPicking} />
        )}
      </AnimatePresence>

      {data.areas.length > 1 && (
        <p className="-mb-1 px-1 text-right text-[12px] text-ink-faint">Arraste pela alça para ordenar</p>
      )}

      <Reorder.Group
        ref={areasRef}
        as="div"
        axis="y"
        values={areaOrder}
        onReorder={setAreaOrder}
        className="flex flex-col gap-3"
      >
        {areaOrder.map((id, i) => {
          const area = areasById.get(id)
          if (!area) return null
          return (
            <AreaCard
              key={id}
              index={i}
              area={area}
              data={data}
              period={period}
              bounds={areasRef}
              onDrop={dropArea}
              onOpenSubject={onOpenSubject}
              onAdd={() => setAddingTo(id)}
              onError={setError}
            />
          )
        })}
      </Reorder.Group>

      <NewArea onError={setError} first={data.areas.length === 0} />

      <AnimatePresence>
        {error && (
          <m.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-1 text-[14px] text-danger"
          >
            {error}
          </m.p>
        )}
      </AnimatePresence>

      <PickAreaSheet subject={picking} areas={data.areas} onClose={() => setPicking(null)} onError={setError} />
      <AddSubjectsSheet
        area={addingTo ? (areasById.get(addingTo) ?? null) : null}
        data={data}
        onClose={() => setAddingTo(null)}
        onError={setError}
      />
    </div>
  )
}

/**
 * Ordem local de uma lista que o servidor também guarda. Durante o arraste a tela usa a ordem
 * daqui; quando o servidor manda outra (matéria nova, área apagada), ela passa a valer.
 */
function useSyncedOrder(ids: string[]) {
  const key = ids.join()
  const [order, setOrder] = useState(ids)
  const [seen, setSeen] = useState(key)
  if (key !== seen) {
    setSeen(key)
    setOrder(ids)
  }
  return [order, setOrder] as const
}

// --- Matérias sem área ----------------------------------------------------------------------

function LooseStrip({
  subjects,
  hasAreas,
  onPick,
}: {
  subjects: SubjectGrades[]
  hasAreas: boolean
  onPick: (s: SubjectGrades) => void
}) {
  return (
    <m.section
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: -12, transition: { duration: 0.25, ease: EASE } }}
      className="overflow-hidden rounded-xl border border-dashed border-line-strong bg-white/[0.015] px-4 py-3.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Sem área</p>
        <p className="tabular text-[12px] text-ink-faint">{pluralize(subjects.length, 'matéria', 'matérias')}</p>
      </div>
      <p className="mt-1 text-[13px] leading-snug text-ink-muted">
        {hasAreas
          ? 'Toque numa matéria para escolher a área — ou use “+ Adicionar matéria” dentro da área para levar várias de uma vez.'
          : 'Crie a primeira área lá embaixo. Depois é só marcar as matérias que entram nela.'}
      </p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {subjects.map((s) => (
            <m.li
              key={s.subject_id}
              layout
              className="max-w-full"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.18 } }}
              transition={SPRING}
            >
              <m.button
                type="button"
                disabled={!hasAreas}
                whileTap={{ scale: 0.94 }}
                onClick={() => onPick(s)}
                title={s.name}
                className="inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60"
              >
                <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="min-w-0 truncate">{s.name}</span>
              </m.button>
            </m.li>
          ))}
        </AnimatePresence>
      </ul>
    </m.section>
  )
}

// --- Cartão da área -------------------------------------------------------------------------

function AreaCard({
  index,
  area,
  data,
  period,
  bounds,
  onDrop,
  onOpenSubject,
  onAdd,
  onError,
}: {
  index: number
  area: AreaGrades
  data: GradesSummary
  period: number
  bounds: RefObject<HTMLDivElement | null>
  onDrop: () => void
  onOpenSubject: (s: SubjectGrades) => void
  onAdd: () => void
  onError: (m: string | null) => void
}) {
  const controls = useDragControls()
  const update = useUpdateArea()
  const remove = useDeleteArea()
  const setSubjects = useSetAreaSubjects()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(area.name)
  const [confirm, setConfirm] = useState(false)

  const byId = new Map(data.subjects.map((s) => [s.subject_id, s]))
  const [order, setOrder] = useSyncedOrder(area.subject_ids)
  // A matéria arrastada fica dentro da lista da própria área — não passa por cima do cabeçalho.
  const listRef = useRef<HTMLUListElement>(null)
  const p = area.periods.find((x) => x.period === period)
  const value = p?.average ?? null
  const good = value !== null && value >= data.passing_grade
  // Enquanto alguma matéria não fechou os pontos do trimestre, a média ainda vai subir:
  // pintar de vermelho agora seria mentira.
  const parcial =
    data.grade_mode === 'sum' &&
    area.subject_ids.some((id) => {
      const sp = byId.get(id)?.periods.find((x) => x.period === period)
      return sp?.max_points != null && sp.max_points < data.grade_max
    })
  const fill = value === null ? 0 : Math.min(value / data.grade_max, 1)
  const passMark = Math.min(data.passing_grade / data.grade_max, 1)

  function dropSubject() {
    if (order.join() !== area.subject_ids.join()) {
      setSubjects.mutate({ areaId: area.id, subjectIds: order }, { onError: (e) => onError(errorMessage(e)) })
    }
  }

  return (
    <Reorder.Item
      as="div"
      value={area.id}
      dragListener={false}
      dragControls={controls}
      dragConstraints={bounds}
      dragElastic={0.06}
      onDragEnd={onDrop}
      initial={{ opacity: 0, y: 14 }}
      // o atraso fica só na entrada; na reordenação os cartões andam juntos
      animate={{ opacity: 1, y: 0, transition: { ...SPRING, delay: Math.min(index, 6) * 0.05 } }}
      transition={SPRING}
      whileDrag={{ scale: 1.02, zIndex: 20, boxShadow: '0 18px 40px rgb(0 0 0 / 55%)' }}
      className="relative overflow-hidden rounded-xl border border-line bg-surface"
    >
      {/* trilho e brilho com a cor da área: dá identidade sem precisar de ícone */}
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: area.color }} aria-hidden />
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-[0.07]"
        style={{ background: `linear-gradient(180deg, ${area.color}, transparent)` }}
        aria-hidden
      />

      <div className="relative flex items-start gap-1 pt-3 pr-3 pl-1.5">
        <Handle controls={controls} label={`Arrastar ${area.name} para reordenar`} />
        <div className="min-w-0 flex-1 pt-0.5">
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
                } else setName(area.name)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') {
                  setName(area.name)
                  setEditing(false)
                }
              }}
              className="w-full rounded-md border border-accent bg-elevated px-2 py-1 text-[17px] font-semibold outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Toque para renomear"
              className="block max-w-full truncate text-left text-[17px] font-semibold tracking-[-0.01em]"
            >
              {area.name}
            </button>
          )}
          <p className="mt-0.5 text-[12px] text-ink-faint">
            {area.subject_ids.length === 0
              ? 'Nenhuma matéria ainda'
              : `${p?.with_grade ?? 0} de ${pluralize(area.subject_ids.length, 'matéria lançada', 'matérias lançadas')}`}
            {parcial && ' · parcial'}
            {area.year_average !== null && ` · ano ${fmtGrade(area.year_average)}`}
          </p>
        </div>
        <div className="shrink-0 pt-0.5 text-right">
          <p
            className={cn(
              'tabular text-[28px] leading-none font-semibold tracking-[-0.03em] transition-colors',
              value === null ? 'text-ink-faint' : parcial ? 'text-ink' : good ? 'text-accent' : 'text-danger',
            )}
          >
            {value === null ? '—' : <CountUp value={value} decimals={decimalsOf(value)} />}
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">{periodLabel(period, data.periods_per_year, true)}</p>
        </div>
        <button
          type="button"
          aria-label={`Excluir ${area.name}`}
          onClick={() => setConfirm(true)}
          className="-mr-1 shrink-0 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-white/5 hover:text-danger"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* barra da média: cheia = nota máxima; o risquinho é a média mínima da escola */}
      <div className="relative mx-4 mt-3 mb-3.5 h-1.5 rounded-full bg-white/[0.06]">
        <m.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: area.color }}
          initial={{ width: 0 }}
          animate={{ width: `${fill * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
        <span
          className="absolute -top-1 h-3.5 w-px bg-white/35"
          style={{ left: `${passMark * 100}%` }}
          title={`Média mínima ${fmtGrade(data.passing_grade)}`}
          aria-hidden
        />
      </div>

      <div className="relative border-t border-line">
        {order.length > 0 && (
          <Reorder.Group
            ref={listRef}
            as="ul"
            axis="y"
            values={order}
            onReorder={setOrder}
            className="divide-y divide-line"
          >
            <AnimatePresence initial={false}>
              {order.map((id) => {
                const s = byId.get(id)
                if (!s) return null
                return (
                  <SubjectRow
                    key={id}
                    subject={s}
                    data={data}
                    period={period}
                    bounds={listRef}
                    onOpen={() => onOpenSubject(s)}
                    onDrop={dropSubject}
                  />
                )
              })}
            </AnimatePresence>
          </Reorder.Group>
        )}
        <m.button
          type="button"
          onClick={onAdd}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'flex w-full items-center gap-2 px-4 text-left text-[14px] font-semibold text-accent transition-colors hover:bg-white/[0.03]',
            order.length > 0 ? 'border-t border-line py-3' : 'py-3.5',
          )}
        >
          <span className="grid size-5 place-items-center rounded-full bg-accent-soft text-[15px] leading-none">+</span>
          {order.length > 0 ? 'Adicionar matéria' : 'Adicionar matérias a esta área'}
        </m.button>
      </div>

      <Dialog
        open={confirm}
        title={`Excluir a área ${area.name}?`}
        description="As matérias e as notas continuam. Elas só ficam sem área."
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          remove.mutate(area.id, {
            onSuccess: () => setConfirm(false),
            onError: (e) => {
              setConfirm(false)
              onError(errorMessage(e))
            },
          })
        }
      />
    </Reorder.Item>
  )
}

/** A alça ⠿: só ela começa o arraste, assim a rolagem da página continua livre. */
function Handle({ controls, label }: { controls: DragControls; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        buzz(8)
        controls.start(e)
      }}
      className="flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-ink-faint transition-colors hover:text-ink-muted active:cursor-grabbing"
    >
      <svg className="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <circle cx="5.5" cy="3.5" r="1.4" />
        <circle cx="10.5" cy="3.5" r="1.4" />
        <circle cx="5.5" cy="8" r="1.4" />
        <circle cx="10.5" cy="8" r="1.4" />
        <circle cx="5.5" cy="12.5" r="1.4" />
        <circle cx="10.5" cy="12.5" r="1.4" />
      </svg>
    </button>
  )
}

/** Uma matéria dentro da área: alça para ordenar, e o resto da linha abre as notas. */
function SubjectRow({
  subject,
  data,
  period,
  bounds,
  onOpen,
  onDrop,
}: {
  subject: SubjectGrades
  data: GradesSummary
  period: number
  bounds: RefObject<HTMLUListElement | null>
  onOpen: () => void
  onDrop: () => void
}) {
  const controls = useDragControls()
  const p = subject.periods.find((x) => x.period === period)
  const value = p?.average ?? null
  const sum = data.grade_mode === 'sum'
  // Na soma de pontos: quanto já foi lançado do total do trimestre.
  const launched = sum ? (p?.max_points ?? null) : null
  const partial = launched !== null && launched < data.grade_max && !p?.over_limit
  // As atividades do trimestre aparecem embaixo do nome, cada uma com a nota ao lado.
  const items = subject.entry_mode === 'items' ? (p?.grades ?? []) : []

  let caption: string | null = null
  if (value !== null && p?.over_limit) caption = `média das ${items.length || p.grades.length} atividades`
  else if (value !== null && partial && launched !== null)
    caption = `${fmtGrade(launched)} de ${fmtGrade(data.grade_max)} lançados · ${Math.round((value / launched) * 100)}% do que valeu`
  else if (value !== null && launched !== null && items.length === 0) caption = `${fmtGrade(value)} de ${fmtGrade(launched)}`

  return (
    <Reorder.Item
      as="li"
      value={subject.subject_id}
      dragListener={false}
      dragControls={controls}
      dragConstraints={bounds}
      dragElastic={0.06}
      onDragEnd={onDrop}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10, transition: { duration: 0.15 } }}
      transition={SPRING}
      whileDrag={{ scale: 1.02, zIndex: 10, boxShadow: '0 12px 30px rgb(0 0 0 / 50%)' }}
      className="relative flex items-start bg-surface pt-1 pl-1.5"
    >
      <Handle controls={controls} label={`Arrastar ${subject.name} para reordenar`} />
      <button
        type="button"
        onClick={onOpen}
        className="block min-w-0 flex-1 py-2 pr-4 pl-1 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="flex items-start gap-3">
          <span className="mt-[7px] size-2.5 shrink-0 rounded-full" style={{ background: subject.color }} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] leading-6">{subject.name}</span>
            {caption && <span className="block truncate text-[11px] text-ink-faint">{caption}</span>}
          </span>
          {value === null ? (
            <span className="mt-0.5 shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">
              Lançar
            </span>
          ) : (
            <span
              className={cn(
                'tabular shrink-0 text-right text-[17px] leading-6 font-semibold',
                partial || value >= data.passing_grade ? 'text-ink' : 'text-danger',
              )}
            >
              {fmtGrade(value)}
            </span>
          )}
        </span>
        {/* As atividades ocupam a linha inteira (alinhadas ao nome), com a nota colada à direita,
            na mesma coluna da nota da matéria. */}
        {items.length > 0 && (
          <span className="relative mt-1.5 mb-0.5 ml-[22px] block pl-3">
            <span
              className="absolute inset-y-1 left-0 w-0.5 rounded-full opacity-50"
              style={{ background: subject.color }}
              aria-hidden
            />
            {items.map((g, i) => (
              <m.span
                key={g.id}
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.22, ease: EASE }}
                className="flex items-baseline gap-2 py-[3px] text-[13px]"
              >
                <span className="min-w-0 truncate text-ink-muted" title={g.title ?? undefined}>
                  {g.title ?? `Avaliação ${i + 1}`}
                </span>
                <span className="mb-[4px] min-w-3 flex-1 border-b border-dotted border-white/15" aria-hidden />
                <span className="tabular shrink-0 font-medium text-ink">
                  {fmtScore(g.value)}
                  {sum && g.max_points !== null && (
                    <span className="font-normal text-ink-faint">/{fmtGrade(g.max_points)}</span>
                  )}
                  {!sum && g.weight !== 1 && (
                    <span className="font-normal text-ink-faint"> · peso {fmtGrade(g.weight)}</span>
                  )}
                </span>
              </m.span>
            ))}
          </span>
        )}
      </button>
    </Reorder.Item>
  )
}

// --- Nova área ------------------------------------------------------------------------------

function NewArea({ onError, first }: { onError: (m: string | null) => void; first: boolean }) {
  const create = useCreateArea()
  const [open, setOpen] = useState(first)
  const [name, setName] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onError(null)
    try {
      await create.mutateAsync({ name: name.trim() })
      setName('')
      setOpen(false)
    } catch (err) {
      onError(errorMessage(err))
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {open ? (
        <m.form
          key="form"
          onSubmit={submit}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="flex items-center gap-2 rounded-xl border border-accent/40 bg-surface p-2 pl-3.5"
        >
          <input
            autoFocus={!first}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && !first && setOpen(false)}
            maxLength={40}
            placeholder="Nome da área · ex.: Linguagens, Exatas, Técnico"
            aria-label="Nome da nova área"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
          />
          <m.button
            type="submit"
            whileTap={{ scale: 0.95 }}
            disabled={!name.trim() || create.isPending}
            className="h-10 shrink-0 rounded-lg bg-accent px-4 text-[14px] font-semibold text-on-accent transition-opacity disabled:opacity-40"
          >
            {create.isPending ? 'Criando…' : 'Criar'}
          </m.button>
        </m.form>
      ) : (
        <m.button
          key="botao"
          type="button"
          onClick={() => setOpen(true)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          whileTap={{ scale: 0.98 }}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-[14px] font-semibold text-ink-muted transition-colors hover:border-accent/50 hover:text-accent"
        >
          <span className="text-[18px] leading-none">+</span> Nova área
        </m.button>
      )}
    </AnimatePresence>
  )
}

// --- Folhas ---------------------------------------------------------------------------------

/** Matéria sem área, tocada: escolhe para onde ela vai. Resposta imediata. */
function PickAreaSheet({
  subject,
  areas,
  onClose,
  onError,
}: {
  subject: SubjectGrades | null
  areas: AreaGrades[]
  onClose: () => void
  onError: (m: string | null) => void
}) {
  const assign = useSetSubjectGradeSettings()
  return (
    <Sheet open={subject !== null} onClose={onClose} title={subject ? `Área de ${subject.name}` : ''}>
      <ul className="flex flex-col gap-1.5">
        {areas.map((a, i) => (
          <m.li key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: i * 0.03 }}>
            <m.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (subject) assign.mutate({ id: subject.subject_id, area_id: a.id }, { onError: (e) => onError(errorMessage(e)) })
                onClose()
              }}
              className="relative flex w-full items-center gap-3 overflow-hidden rounded-lg border border-line bg-elevated px-3.5 py-3 text-left text-[15px] transition-colors hover:border-line-strong"
            >
              <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: a.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
              <span className="shrink-0 text-[12px] text-ink-faint">{pluralize(a.subject_ids.length, 'matéria', 'matérias')}</span>
            </m.button>
          </m.li>
        ))}
      </ul>
    </Sheet>
  )
}

/**
 * "+ Adicionar matéria": marca quantas quiser e salva de uma vez.
 * Desmarcar uma que já estava na área tira ela de lá (as notas ficam).
 */
function AddSubjectsSheet({
  area,
  data,
  onClose,
  onError,
}: {
  area: AreaGrades | null
  data: GradesSummary
  onClose: () => void
  onError: (m: string | null) => void
}) {
  const save = useSetAreaSubjects()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  // Guarda a última área para a folha não ficar vazia enquanto desliza para fora.
  const [last, setLast] = useState<AreaGrades | null>(area)
  const areaNames = new Map(data.areas.map((a) => [a.id, a.name]))

  // Toda vez que abre, começa com as matérias que já estão na área marcadas.
  if (area && area.id !== openedFor) {
    setOpenedFor(area.id)
    setSelected(new Set(area.subject_ids))
    setQuery('')
  }
  if (!area && openedFor !== null) setOpenedFor(null)
  if (area && area !== last) setLast(area)

  const shown = area ?? last
  const q = query.trim().toLocaleLowerCase('pt-BR')
  const match = (s: SubjectGrades) => !q || s.name.toLocaleLowerCase('pt-BR').includes(q)
  const here = data.subjects.filter((s) => shown && s.area_id === shown.id && match(s))
  const loose = data.subjects.filter((s) => !s.area_id && match(s))
  const elsewhere = data.subjects.filter((s) => shown && s.area_id && s.area_id !== shown.id && match(s))
  const before = new Set(shown?.subject_ids ?? [])
  const changed = before.size !== selected.size || [...selected].some((id) => !before.has(id))

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submit() {
    if (!area) return
    // quem já estava mantém o lugar; as novas entram no fim, na ordem da lista
    const kept = area.subject_ids.filter((id) => selected.has(id))
    const added = data.subjects.map((s) => s.subject_id).filter((id) => selected.has(id) && !before.has(id))
    save.mutate({ areaId: area.id, subjectIds: [...kept, ...added] }, { onError: (e) => onError(errorMessage(e)) })
    onClose()
  }

  const group = (title: string, list: SubjectGrades[], hint?: (s: SubjectGrades) => string | null) =>
    list.length > 0 && (
      <div className="mt-3 first:mt-0">
        <p className="mb-1.5 px-1 text-[11px] font-semibold tracking-[0.08em] text-ink-faint uppercase">{title}</p>
        <ul className="flex flex-col gap-1">
          {list.map((s) => (
            <li key={s.subject_id}>
              <PickRow subject={s} checked={selected.has(s.subject_id)} hint={hint?.(s) ?? null} onToggle={() => toggle(s.subject_id)} />
            </li>
          ))}
        </ul>
      </div>
    )

  return (
    <Sheet open={area !== null} onClose={onClose} title={shown ? `Matérias de ${shown.name}` : ''}>
      {data.subjects.length > 8 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar matéria"
          aria-label="Buscar matéria"
          className="mb-3 h-11 w-full rounded-lg border border-line bg-elevated px-3.5 text-[15px] outline-none placeholder:text-ink-faint focus:border-accent/60"
        />
      )}
      {group('Nesta área', here)}
      {group('Sem área', loose)}
      {group('Em outras áreas', elsewhere, (s) =>
        selected.has(s.subject_id) ? `sai de ${areaNames.get(s.area_id!) ?? 'outra área'}` : (areaNames.get(s.area_id!) ?? null),
      )}
      {here.length + loose.length + elsewhere.length === 0 && (
        <p className="py-6 text-center text-[14px] text-ink-faint">
          {q ? 'Nenhuma matéria com esse nome.' : 'Cadastre as matérias em Estudos primeiro.'}
        </p>
      )}
      <div className="sticky -bottom-5 -mx-5 mt-4 bg-gradient-to-t from-surface via-surface to-transparent px-5 pt-3 pb-5 lg:rounded-b-xl">
        <m.button
          type="button"
          whileTap={{ scale: 0.98 }}
          disabled={!changed}
          onClick={submit}
          className="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-on-accent transition-opacity disabled:opacity-40"
        >
          {changed ? `Salvar · ${pluralize(selected.size, 'matéria', 'matérias')}` : 'Nada mudou'}
        </m.button>
      </div>
    </Sheet>
  )
}

function PickRow({
  subject,
  checked,
  hint,
  onToggle,
}: {
  subject: SubjectGrades
  checked: boolean
  hint: string | null
  onToggle: () => void
}) {
  return (
    <m.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      whileTap={{ scale: 0.985 }}
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors',
        checked ? 'border-accent/50 bg-accent-soft' : 'border-line bg-elevated hover:border-line-strong',
      )}
    >
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: subject.color }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{subject.name}</span>
        {hint && <span className="block truncate text-[11px] text-ink-faint">{hint}</span>}
      </span>
      <span
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full border transition-colors',
          checked ? 'border-accent bg-accent text-on-accent' : 'border-line-strong',
        )}
        aria-hidden
      >
        <AnimatePresence initial={false}>
          {checked && (
            <m.svg
              key="ok"
              viewBox="0 0 24 24"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 28 }}
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </m.svg>
          )}
        </AnimatePresence>
      </span>
    </m.button>
  )
}
