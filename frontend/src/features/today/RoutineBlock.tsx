import { Link } from 'react-router'

import { Card, Checkbox, Section } from '@/components/ui'
import { useCheckItem } from '@/features/routines/api'
import { cn, shortTime } from '@/lib/format'
import type { DayRoutine } from '@/lib/types'

interface Props {
  date: string
  routine: DayRoutine
  /** título da seção; padrão é o nome da rotina */
  title?: string
  /** ontem ainda pode ser marcado; dias anteriores só leitura */
  editable: boolean
}

/** Checklist de uma rotina no dia. Toque em qualquer parte da linha marca o item. */
export function RoutineBlock({ date, routine, title, editable }: Props) {
  const check = useCheckItem(date)
  const allDone = routine.planned > 0 && routine.completed === routine.planned

  return (
    <Section
      title={title ?? routine.name}
      aside={
        <span className={cn('tabular', allDone && 'text-accent')}>
          {routine.completed}/{routine.planned}
          {routine.start_time && <span className="text-ink-faint"> · {shortTime(routine.start_time)}</span>}
        </span>
      }
    >
      <Card padded={false} className="divide-y divide-line overflow-hidden">
        {routine.items.map((item) => {
          const done = item.completed_at !== null
          return (
            <label
              key={item.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors select-none',
                editable ? 'active:bg-white/4' : 'cursor-default',
              )}
            >
              <Checkbox
                label={item.title}
                checked={done}
                disabled={!editable || check.isPending}
                onChange={(next) => check.mutate({ itemId: item.id, done: next })}
              />
              <span className={cn('min-w-0 flex-1 text-[15px] transition-colors', done && 'text-ink-faint line-through')}>
                {item.title}
              </span>
              {item.duration_minutes && (
                <span className="tabular shrink-0 text-[12px] text-ink-faint">{item.duration_minutes} min</span>
              )}
            </label>
          )
        })}
      </Card>
    </Section>
  )
}

/** Quando a rotina existe mas não tem itens (ou não existe): ensina o próximo passo. */
export function RoutinePlaceholder({ title, text, to }: { title: string; text: string; to: string }) {
  return (
    <Section title={title}>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3.5">
        <p className="text-[14px] text-ink-muted">{text}</p>
        <Link to={to} className="shrink-0 text-[13px] font-semibold text-accent">
          Configurar
        </Link>
      </div>
    </Section>
  )
}
