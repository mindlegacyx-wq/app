import { useState } from 'react'
import { Link } from 'react-router'

import { Button, Card, DayPicker, EmptyState, Fab, Sheet, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { WEEKDAYS_LONG, WEEKDAYS_SHORT, cn, onWeekday, pluralize, shortTime, todayIn } from '@/lib/format'
import type { ScheduleBlock } from '@/lib/types'

import { BlockSheet } from './BlockSheet'
import { useCopyDay, useScheduleWeek } from './api'
import { blockColor, fmtDuration, kindLabel, suggestStart } from './shared'

/** 0 = segunda … 6 = domingo, a partir de "YYYY-MM-DD". */
function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/** Tela 29: agenda da semana — abas por dia, blocos com horário e cor da matéria, copiar dia. */
export function AgendaPage() {
  const user = useAuth((s) => s.user)!
  const todayWd = weekdayOf(todayIn(user.timezone))
  const week = useScheduleWeek()
  const [selected, setSelected] = useState(todayWd)
  const [sheet, setSheet] = useState<{ open: boolean; block?: ScheduleBlock }>({
    open: false,
  })
  const [copyOpen, setCopyOpen] = useState(false)

  const day = week.data?.days[selected]
  const blocks = day?.blocks ?? []
  const activeMinutes = blocks.filter((b) => b.is_active).reduce((n, b) => n + b.duration_minutes, 0)

  return (
    <div className="safe-top pt-2 pb-28">
      <header className="flex h-12 items-center gap-3">
        <Link
          to="/rotina"
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
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold tracking-[-0.02em]">Agenda</h1>
        <Link to="/agenda/materias" className="text-[13px] font-semibold text-accent">
          Matérias
        </Link>
      </header>

      <div className="mt-3 grid grid-cols-7 gap-1" role="tablist" aria-label="Dia da semana">
        {WEEKDAYS_SHORT.map((short, d) => {
          const count = week.data?.days[d]?.blocks.filter((b) => b.is_active).length ?? 0
          const on = d === selected
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={WEEKDAYS_LONG[d]}
              onClick={() => setSelected(d)}
              className={cn(
                'flex h-14 flex-col items-center justify-center gap-1 rounded-md border text-[14px] font-semibold transition-colors',
                on ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink-muted hover:text-ink',
                d === todayWd && !on && 'border-line-strong text-ink',
              )}
            >
              <span>{short}</span>
              <span
                className={cn('h-1.5 w-1.5 rounded-full', count > 0 ? (on ? 'bg-accent' : 'bg-ink-faint') : 'bg-transparent')}
                aria-hidden
              />
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex items-baseline justify-between px-0.5">
        <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">
          {WEEKDAYS_LONG[selected]}
          {selected === todayWd && ' · hoje'}
        </h2>
        {blocks.length > 0 && (
          <span className="text-[13px] text-ink-muted">
            {pluralize(blocks.length, 'bloco', 'blocos')} · {fmtDuration(activeMinutes)}
          </span>
        )}
      </div>

      {week.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : week.isError ? (
        <EmptyState className="mt-3" title="Não foi possível carregar" description={errorMessage(week.error)} />
      ) : blocks.length === 0 ? (
        <EmptyState
          className="mt-3"
          title={`Nada ${onWeekday(selected)}`}
          description="Cadastre aulas, curso, treino e outros compromissos fixos. A tela Hoje mostra a linha do tempo do dia."
          action={<Button onClick={() => setSheet({ open: true })}>Adicionar bloco</Button>}
        />
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {blocks.map((b) => (
            <li key={b.id}>
              <BlockRow block={b} onClick={() => setSheet({ open: true, block: b })} />
            </li>
          ))}
        </ol>
      )}

      {blocks.length > 0 && (
        <button
          type="button"
          onClick={() => setCopyOpen(true)}
          className="mt-4 w-full rounded-lg border border-dashed border-line-strong px-4 py-3 text-[14px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          Copiar {WEEKDAYS_LONG[selected]} para outros dias…
        </button>
      )}

      <Fab label="Novo bloco" onClick={() => setSheet({ open: true })} />

      <BlockSheet
        open={sheet.open}
        weekday={selected}
        suggestedStart={suggestStart(blocks)}
        block={sheet.block}
        onClose={() => setSheet({ open: false })}
      />
      <CopyDaySheet open={copyOpen} from={selected} onClose={() => setCopyOpen(false)} />
    </div>
  )
}

function BlockRow({ block, onClick }: { block: ScheduleBlock; onClick: () => void }) {
  const detail = [kindLabel[block.kind], block.location].filter(Boolean).join(' · ')
  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      <Card
        padded={false}
        className={cn('flex items-stretch gap-3 overflow-hidden transition-colors hover:bg-elevated', !block.is_active && 'opacity-55')}
      >
        <span className="w-1.5 shrink-0" style={{ background: blockColor(block) }} aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-4">
          <div className="tabular w-[52px] shrink-0 text-[13px] leading-tight text-ink-muted">
            <div className="font-semibold text-ink">{shortTime(block.start_time)}</div>
            <div>{shortTime(block.end_time)}</div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">{block.title}</p>
            <p className="truncate text-[12px] text-ink-faint">
              {detail}
              {!block.is_active && ' · pausado'}
            </p>
          </div>
          <span className="tabular shrink-0 text-[12px] text-ink-faint">{fmtDuration(block.duration_minutes)}</span>
        </div>
      </Card>
    </button>
  )
}

function CopyDaySheet({ open, from, onClose }: { open: boolean; from: number; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={`Copiar ${WEEKDAYS_LONG[from]} para…`}>
      <CopyDayBody key={from} from={from} onClose={onClose} />
    </Sheet>
  )
}

function CopyDayBody({ from, onClose }: { from: number; onClose: () => void }) {
  const copy = useCopyDay()
  const [to, setTo] = useState<number[]>([])
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const targets = to.filter((d) => d !== from)

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[14px] text-ink-muted">
        Os blocos ativos de {WEEKDAYS_LONG[from]} são copiados com o mesmo horário. Horários que já estiverem ocupados são pulados.
      </p>
      <DayPicker value={to} onChange={(d) => setTo(d.filter((x) => x !== from))} label="Copiar para" />
      {result && <p className="text-[14px] text-accent">{result}</p>}
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <Button
        size="lg"
        full
        disabled={targets.length === 0}
        loading={copy.isPending}
        onClick={() =>
          copy.mutate(
            { from, to: targets },
            {
              onSuccess: (r) => {
                setError(null)
                setResult(
                  `${pluralize(r.created, 'bloco criado', 'blocos criados')}${r.skipped ? ` · ${pluralize(r.skipped, 'pulado por conflito', 'pulados por conflito')}` : ''}.`,
                )
                window.setTimeout(onClose, 900)
              },
              onError: (e) => setError(errorMessage(e)),
            },
          )
        }
      >
        {targets.length > 1 ? `Copiar para ${targets.length} dias` : 'Copiar'}
      </Button>
    </div>
  )
}
