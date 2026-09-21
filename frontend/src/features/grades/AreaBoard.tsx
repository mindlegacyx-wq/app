import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Button, Card, Dialog, Field } from '@/components/ui'
import { CountUp } from '@/components/ui/CountUp'
import { errorMessage } from '@/lib/api'
import { cn, pluralize } from '@/lib/format'
import type { AreaGrades, GradesSummary, SubjectGrades } from '@/lib/types'

import { useCreateArea, useDeleteArea, useSetSubjectGradeSettings, useUpdateArea } from './api'
import { decimalsOf, fmtGrade, periodLabel } from './shared'

interface Props {
  data: GradesSummary
  period: number
  onOpenSubject: (s: SubjectGrades) => void
}

/**
 * A tela de notas quando o usuário estuda por área.
 *
 * Tudo num lugar só: escolhe o trimestre em cima, vê a média de cada área com as matérias
 * dentro, e toca na matéria para lançar prova, trabalho e o que mais tiver. As matérias que
 * ainda não têm área ficam numa faixa no topo — dá para arrastar para dentro de uma área
 * (no PC e no celular) ou tocar, que abre a lista de áreas.
 */
export function AreaBoard({ data, period, onOpenSubject }: Props) {
  const create = useCreateArea()
  const assign = useSetSubjectGradeSettings()
  const reduced = useReducedMotion()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [picking, setPicking] = useState<SubjectGrades | null>(null)

  // Onde cada área está na tela, para saber em qual delas a matéria foi solta.
  const boxes = useRef(new Map<string, HTMLElement>())
  // Última posição do dedo e o laço que rola a tela quando ele chega perto da borda.
  const pointer = useRef(0)
  const rolando = useRef<number | null>(null)
  // O navegador dispara um clique no fim do arraste; sem isso a folha de áreas abriria sozinha.
  const arrastou = useRef(false)

  const loose = data.subjects.filter((s) => !s.area_id)

  // Se a tela sair no meio de um arraste, o laço de rolagem para junto.
  useEffect(() => () => pararDeRolar(), [])

  /**
   * Em qual área o dedo está. O motion entrega o ponto contando a rolagem da página e
   * getBoundingClientRect mede a partir do topo da tela — por isso desconto a rolagem,
   * senão o alvo erra assim que a lista fica maior que a tela.
   */
  function areaUnder(pageX: number, pageY: number): string | null {
    const x = pageX - window.scrollX
    const y = pageY - window.scrollY
    for (const [id, el] of boxes.current) {
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id
    }
    return null
  }

  /** Segurar a matéria perto do topo ou do rodapé rola a lista, para alcançar áreas distantes. */
  function rolarNaBorda() {
    if (rolando.current !== null) return
    const passo = () => {
      const y = pointer.current - window.scrollY
      const margem = 96
      const delta =
        y < margem ? -Math.ceil((margem - y) / 5) : y > window.innerHeight - margem ? Math.ceil((y - window.innerHeight + margem) / 5) : 0
      if (delta) window.scrollBy(0, delta)
      rolando.current = requestAnimationFrame(passo)
    }
    rolando.current = requestAnimationFrame(passo)
  }

  function pararDeRolar() {
    if (rolando.current !== null) cancelAnimationFrame(rolando.current)
    rolando.current = null
  }

  function drop(subject: SubjectGrades, x: number, y: number) {
    pararDeRolar()
    // Rede de segurança: se o clique do fim do arraste não vier, o próximo toque vale.
    setTimeout(() => (arrastou.current = false), 150)
    const id = areaUnder(x, y)
    setHover(null)
    if (!id) return
    assign.mutate({ id: subject.subject_id, area_id: id }, { onError: (e) => setError(errorMessage(e)) })
  }

  async function addArea(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    try {
      await create.mutateAsync({ name: name.trim() })
      setName('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {loose.length > 0 && (
        <m.div layout className="rounded-lg border border-dashed border-line-strong px-3.5 py-3">
          <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Sem área</p>
          <p className="mt-0.5 text-[12px] text-ink-faint">
            {data.areas.length === 0
              ? 'Crie uma área aqui embaixo e traga as matérias para dentro.'
              : 'Arraste para uma área — ou toque para escolher.'}
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            <AnimatePresence initial={false}>
              {loose.map((s) => (
                <m.li key={s.subject_id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                  <m.button
                    type="button"
                    drag={data.areas.length > 0 && !reduced}
                    dragSnapToOrigin
                    dragElastic={0.2}
                    whileDrag={{ scale: 1.06, zIndex: 50, boxShadow: '0 12px 30px rgb(0 0 0 / 45%)' }}
                    onDragStart={() => {
                      arrastou.current = true
                      rolarNaBorda()
                    }}
                    onDrag={(_, info) => {
                      pointer.current = info.point.y
                      setHover(areaUnder(info.point.x, info.point.y))
                    }}
                    onDragEnd={(_, info) => drop(s, info.point.x, info.point.y)}
                    onClick={() => {
                      if (arrastou.current) {
                        arrastou.current = false
                        return
                      }
                      setPicking(s)
                    }}
                    className="relative inline-flex h-9 cursor-grab items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink-muted active:cursor-grabbing"
                  >
                    <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
                    {s.name}
                  </m.button>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        </m.div>
      )}

      <AnimatePresence initial={false}>
        {data.areas.map((area, i) => (
          <m.div
            key={area.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, scale: hover === area.id ? 1.015 : 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ delay: Math.min(i, 6) * 0.04, duration: 0.26, ease: [0.25, 1, 0.5, 1] }}
            ref={(el) => {
              if (el) boxes.current.set(area.id, el)
              else boxes.current.delete(area.id)
            }}
          >
            <AreaCard
              area={area}
              data={data}
              period={period}
              highlight={hover === area.id}
              onOpenSubject={onOpenSubject}
              onError={setError}
            />
          </m.div>
        ))}
      </AnimatePresence>

      <form onSubmit={addArea} className="flex items-end gap-2">
        <Field
          label="Nova área"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Ex.: Linguagens · Exatas · Técnico"
          className="flex-1"
        />
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
          Criar
        </Button>
      </form>

      {error && <p className="text-[14px] text-danger">{error}</p>}

      <PickAreaSheet
        subject={picking}
        areas={data.areas}
        onClose={() => setPicking(null)}
        onPick={(areaId) => {
          if (picking) assign.mutate({ id: picking.subject_id, area_id: areaId })
          setPicking(null)
        }}
      />
    </div>
  )
}

function AreaCard({
  area,
  data,
  period,
  highlight,
  onOpenSubject,
  onError,
}: {
  area: AreaGrades
  data: GradesSummary
  period: number
  highlight: boolean
  onOpenSubject: (s: SubjectGrades) => void
  onError: (m: string | null) => void
}) {
  const update = useUpdateArea()
  const remove = useDeleteArea()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(area.name)
  const [confirm, setConfirm] = useState(false)

  const byId = new Map(data.subjects.map((s) => [s.subject_id, s]))
  const subjects = area.subject_ids.map((id) => byId.get(id)).filter(Boolean) as SubjectGrades[]
  const p = area.periods.find((x) => x.period === period)
  const value = p?.average ?? null
  const good = value !== null && value >= data.passing_grade
  // Enquanto alguma matéria não fechou os pontos do trimestre, a média ainda vai subir:
  // pintar de vermelho agora seria mentira.
  const parcial =
    data.grade_mode === 'sum' &&
    subjects.some((s) => {
      const sp = s.periods.find((x) => x.period === period)
      return sp?.max_points != null && sp.max_points < data.grade_max
    })

  return (
    <Card
      padded={false}
      className={cn(
        'overflow-hidden transition-colors duration-150',
        // O alvo do arraste precisa gritar: borda acesa e um fundo com a cor do app.
        highlight && 'border-accent bg-accent-soft',
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-3.5">
        <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: area.color }} aria-hidden />
        <div className="min-w-0 flex-1">
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
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="w-full rounded-md border border-accent bg-surface px-2 py-1 text-[17px] font-semibold outline-none"
            />
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="block w-full truncate text-left text-[17px] font-semibold tracking-[-0.01em]">
              {area.name}
            </button>
          )}
          <p className="mt-0.5 text-[12px] text-ink-faint">
            {subjects.length === 0
              ? 'Nenhuma matéria ainda'
              : `${p?.with_grade ?? 0} de ${pluralize(subjects.length, 'matéria lançada', 'matérias lançadas')}`}
            {parcial && ' · parcial'}
            {area.year_average !== null && ` · ano ${fmtGrade(area.year_average)}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              'tabular text-[26px] leading-none font-semibold tracking-[-0.02em]',
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
          className="-mr-1 shrink-0 p-1 text-ink-faint transition-colors hover:text-danger"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {subjects.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          <AnimatePresence initial={false}>
            {subjects.map((s) => (
              <m.li key={s.subject_id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SubjectRow subject={s} data={data} period={period} onOpen={() => onOpenSubject(s)} />
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

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
    </Card>
  )
}

/** Uma matéria dentro da área: a nota do trimestre e o que ainda falta lançar. */
function SubjectRow({
  subject,
  data,
  period,
  onOpen,
}: {
  subject: SubjectGrades
  data: GradesSummary
  period: number
  onOpen: () => void
}) {
  const p = subject.periods.find((x) => x.period === period)
  const value = p?.average ?? null
  const sum = data.grade_mode === 'sum'
  // Na soma de pontos: quanto já foi lançado do total do trimestre.
  const launched = sum ? (p?.max_points ?? null) : null
  const partial = launched !== null && launched < data.grade_max

  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-elevated">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: subject.color }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{subject.name}</span>
        {value !== null && launched !== null && (
          <span className="block text-[11px] text-ink-faint">
            {partial
              ? `${fmtGrade(launched)} de ${fmtGrade(data.grade_max)} lançados · ${Math.round((value / launched) * 100)}% do que valeu`
              : `${fmtGrade(value)} de ${fmtGrade(launched)}`}
          </span>
        )}
      </span>
      {value === null ? (
        <span className="shrink-0 text-[13px] font-semibold text-accent">Lançar</span>
      ) : (
        <span
          className={cn(
            'tabular shrink-0 text-[17px] font-semibold',
            partial || value >= data.passing_grade ? 'text-ink' : 'text-danger',
          )}
        >
          {fmtGrade(value)}
        </span>
      )}
    </button>
  )
}

/** Toque na matéria sem área: escolher para onde ela vai (o caminho que o dedo acerta). */
function PickAreaSheet({
  subject,
  areas,
  onClose,
  onPick,
}: {
  subject: SubjectGrades | null
  areas: AreaGrades[]
  onClose: () => void
  onPick: (areaId: string) => void
}) {
  return (
    <AnimatePresence>
      {subject && (
        <m.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center lg:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
        >
          <m.div
            role="dialog"
            aria-label={`Área de ${subject.name}`}
            className="safe-bottom w-full max-w-lg rounded-t-xl border-t border-line bg-surface p-5 shadow-sheet lg:max-w-sm lg:rounded-xl lg:border"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[17px] font-semibold">{subject.name}</h2>
            <p className="mt-1 text-[13px] text-ink-faint">Em qual área esta matéria entra?</p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {areas.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onPick(a.id)}
                    className="flex w-full items-center gap-2.5 rounded-md border border-line bg-elevated px-3 py-2.5 text-left text-[15px] transition-colors active:bg-surface"
                  >
                    <span className="size-2.5 rounded-full" style={{ background: a.color }} aria-hidden />
                    {a.name}
                  </button>
                </li>
              ))}
            </ul>
            {areas.length === 0 && <p className="mt-3 text-[13px] text-ink-faint">Crie uma área primeiro.</p>}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
