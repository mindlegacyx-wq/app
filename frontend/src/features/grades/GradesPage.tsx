import { AnimatePresence, m } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Button, Card, Chip, EmptyState, Field, Sheet, Spinner, Toggle } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, pluralize } from '@/lib/format'
import type { AreaGrades, Grade, GradeEntryMode, PeriodGrades, SubjectGrades } from '@/lib/types'

import { AreaBoard } from './AreaBoard'
import { GradeSheet } from './GradeSheet'
import { useCreateGrade, useGrades, useSetSubjectGradeSettings, useUpdateGrade, useUpdateGradeSettings } from './api'
import { fmtGrade, parseGrade, periodLabel, periodsName, statusLabel, statusTone } from './shared'

/** Tela 36: notas por matéria e período, média do ano e "quanto preciso tirar". */
export function GradesPage() {
  const [year, setYear] = useState<number | null>(null)
  const grades = useGrades(year)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [detail, setDetail] = useState<SubjectGrades | null>(null)
  const [period, setPeriod] = useState<number | null>(null)

  const data = grades.data
  // Trimestre em foco: o último com alguma nota, até o usuário escolher outro.
  const lastWithGrades = data
    ? Math.max(1, ...data.subjects.flatMap((s) => s.periods.filter((p) => p.average !== null).map((p) => p.period)))
    : 1
  const current = period ?? lastWithGrades
  // Mantém o detalhe aberto sincronizado com a última leitura.
  const openSubject = detail ? (data?.subjects.find((s) => s.subject_id === detail.subject_id) ?? null) : null

  return (
    <div className="safe-top pt-2 pb-10">
      <header className="flex h-12 items-center gap-3">
        <Link
          to="/estudos"
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
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold tracking-[-0.02em]">Notas</h1>
        <button type="button" onClick={() => setSettingsOpen(true)} className="text-[13px] font-semibold text-accent">
          Configurar
        </button>
      </header>

      {grades.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : grades.isError ? (
        <EmptyState className="mt-6" title="Não foi possível carregar" description={errorMessage(grades.error)} />
      ) : (
        <>
          <p className="mt-2 px-0.5 text-[13px] text-ink-faint">
            Média mínima <span className="font-semibold text-ink-muted">{fmtGrade(data!.passing_grade)}</span> · escala até{' '}
            {fmtGrade(data!.grade_max)} · {data!.grade_mode === 'sum' ? 'soma de pontos' : 'média ponderada'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: data!.periods_per_year }, (_, i) => i + 1).map((n) => (
              <Chip key={n} active={n === current} onClick={() => setPeriod(n)}>
                {periodLabel(n, data!.periods_per_year)}
              </Chip>
            ))}
          </div>

          {data!.years.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {data!.years.map((y) => (
                <Chip key={y} active={y === data!.year} onClick={() => setYear(y)}>
                  {y}
                </Chip>
              ))}
            </div>
          )}

          {data!.subjects.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="Nenhuma matéria"
              description="As notas são lançadas por matéria. Crie as matérias na agenda."
              action={
                <Link to="/agenda/materias">
                  <Button>Criar matérias</Button>
                </Link>
              }
            />
          ) : data!.by_area ? (
            <AreaBoard data={data!} period={current} onOpenSubject={setDetail} />
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {data!.subjects.map((s) => (
                <SubjectCard
                  key={s.subject_id}
                  s={s}
                  periodsPerYear={data!.periods_per_year}
                  passing={data!.passing_grade}
                  onOpen={() => setDetail(s)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {data && (
        <SubjectSheet
          open={openSubject !== null}
          subject={openSubject}
          year={data.year}
          periodsPerYear={data.periods_per_year}
          passing={data.passing_grade}
          gradeMax={data.grade_max}
          gradeMode={data.grade_mode}
          areas={data.areas}
          startPeriod={current}
          onClose={() => setDetail(null)}
        />
      )}
      <GradeSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function neededText(s: SubjectGrades, periodsPerYear: number, passing: number): string {
  switch (s.status) {
    case 'no_grades':
      return `Nenhuma nota lançada. Precisa de ${fmtGrade(passing)} em cada ${periodLabel(1, periodsPerYear).split(' ')[1]}.`
    case 'approved':
      return s.remaining_periods > 0
        ? `Média ${fmtGrade(passing)} já garantida. Faltam ${pluralize(s.remaining_periods, 'período', 'períodos')}.`
        : `Ano fechado com ${fmtGrade(s.year_average)}.`
    case 'closed_failed':
      return `Ano fechado com ${fmtGrade(s.year_average)}, abaixo de ${fmtGrade(passing)}.`
    case 'failing':
      return `Precisaria de ${fmtGrade(s.needed_average)} — acima do máximo. Só com recuperação.`
    default: {
      const which =
        s.remaining_periods === 1
          ? `no ${periodLabel(periodsPerYear, periodsPerYear)}`
          : `em cada um dos ${s.remaining_periods} ${periodsName(periodsPerYear)} restantes`
      return `Precisa de ${fmtGrade(s.needed_average)} ${which} para fechar com ${fmtGrade(passing)}.`
    }
  }
}

function SubjectCard({
  s,
  periodsPerYear,
  passing,
  onOpen,
}: {
  s: SubjectGrades
  periodsPerYear: number
  passing: number
  onOpen: () => void
}) {
  return (
    <button type="button" onClick={onOpen} className="block w-full text-left">
      <Card className="transition-colors hover:bg-elevated">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="size-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
            <h3 className="truncate text-[17px] font-semibold tracking-[-0.01em]">{s.name}</h3>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn(
                'tabular text-[22px] leading-none font-semibold tracking-[-0.02em]',
                s.year_average !== null && s.year_average < passing
                  ? 'text-danger'
                  : s.year_average !== null
                    ? 'text-accent'
                    : 'text-ink-faint',
              )}
            >
              {fmtGrade(s.year_average)}
            </p>
            <p className="mt-1 text-[11px] text-ink-faint">média do ano</p>
          </div>
        </div>
        <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${periodsPerYear}, minmax(0, 1fr))` }}>
          {s.periods.map((p) => (
            <div
              key={p.period}
              className={cn(
                'rounded-md border px-2 py-1.5 text-center',
                p.average === null
                  ? 'border-dashed border-line-strong'
                  : p.average >= passing
                    ? 'border-accent/30 bg-accent-soft/40'
                    : 'border-danger/30 bg-danger-soft/40',
              )}
            >
              <p className="text-[10px] tracking-[0.04em] text-ink-faint uppercase">{periodLabel(p.period, periodsPerYear, true)}</p>
              <p
                className={cn(
                  'tabular text-[15px] font-semibold',
                  p.average === null ? 'text-ink-faint' : p.average >= passing ? 'text-accent' : 'text-danger',
                )}
              >
                {fmtGrade(p.average)}
              </p>
            </div>
          ))}
        </div>
        <p className={cn('mt-3 text-[13px]', statusTone(s.status))}>
          <span className="font-semibold">{statusLabel[s.status]}</span> ·{' '}
          <span className={s.status === 'no_grades' || s.status === 'on_track' ? 'text-ink-muted' : ''}>
            {neededText(s, periodsPerYear, passing)}
          </span>
        </p>
      </Card>
    </button>
  )
}

/**
 * A matéria por dentro: em que área ela está, como lança nota e as notas do trimestre
 * escolhido. Um trimestre por vez — a tela antiga mostrava os três e virava rolagem.
 */
function SubjectSheet({
  open,
  subject,
  year,
  periodsPerYear,
  passing,
  gradeMax,
  gradeMode,
  areas,
  startPeriod,
  onClose,
}: {
  open: boolean
  subject: SubjectGrades | null
  year: number
  periodsPerYear: number
  passing: number
  gradeMax: number
  gradeMode: 'weighted' | 'sum'
  areas: AreaGrades[]
  startPeriod: number
  onClose: () => void
}) {
  const [gradeSheet, setGradeSheet] = useState<{ open: boolean; period?: number; grade?: Grade }>({ open: false })
  const [period, setPeriod] = useState(startPeriod)
  const setSubject = useSetSubjectGradeSettings()
  const mode: GradeEntryMode = subject?.entry_mode ?? 'final'

  useEffect(() => {
    if (open) setPeriod(startPeriod)
  }, [open, startPeriod, subject?.subject_id])

  const p = subject?.periods.find((x) => x.period === period) ?? null
  const sum = gradeMode === 'sum'
  const launched = sum ? (p?.max_points ?? null) : null
  // Trimestre ainda aberto: a soma vai crescer, então nada de pintar de vermelho.
  const parcial = launched !== null && launched < gradeMax && !p?.over_limit
  // Quando as atividades passam do teto, a folha mostra a conta que levou à nota.
  const bruto = p ? p.grades.reduce((t, g) => t + g.value, 0) : 0
  const valiaBruta = p && p.grades.every((g) => g.max_points !== null)
    ? p.grades.reduce((t, g) => t + (g.max_points ?? 0), 0)
    : null

  return (
    <>
      <Sheet open={open} onClose={onClose} title={subject?.name ?? 'Matéria'}>
        {subject && (
          <div className="flex flex-col gap-4">
            {areas.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-ink-muted">Área</span>
                <div className="flex flex-wrap gap-2">
                  <Chip
                    active={!subject.area_id}
                    onClick={() => setSubject.mutate({ id: subject.subject_id, clear_area: true })}
                  >
                    Sem área
                  </Chip>
                  {areas.map((a) => (
                    <Chip
                      key={a.id}
                      active={subject.area_id === a.id}
                      onClick={() => setSubject.mutate({ id: subject.subject_id, area_id: a.id })}
                    >
                      <span className="size-2 rounded-full" style={{ background: a.color }} aria-hidden />
                      {a.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-muted">Como lançar nesta matéria</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Como lançar">
                <Chip active={mode === 'final'} onClick={() => setSubject.mutate({ id: subject.subject_id, entry_mode: 'final' })}>
                  Nota final
                </Chip>
                <Chip active={mode === 'items'} onClick={() => setSubject.mutate({ id: subject.subject_id, entry_mode: 'items' })}>
                  Por avaliações
                </Chip>
              </div>
              <p className="text-[12px] text-ink-faint">
                {mode === 'final'
                  ? 'Uma nota por trimestre — a que a escola fechou.'
                  : 'Prova, trabalho, participação… a nota sai delas, mesmo antes de fechar.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Trimestre">
              {Array.from({ length: periodsPerYear }, (_, i) => i + 1).map((n) => (
                <Chip key={n} active={n === period} onClick={() => setPeriod(n)}>
                  {periodLabel(n, periodsPerYear)}
                </Chip>
              ))}
            </div>

            {p && mode === 'final' && (
              <FinalGradeRow
                subjectId={subject.subject_id}
                year={year}
                period={p}
                periodsPerYear={periodsPerYear}
                passing={passing}
                onOpenItems={() => setSubject.mutate({ id: subject.subject_id, entry_mode: 'items' })}
              />
            )}

            {p && mode === 'items' && (
              <section>
                <div className="mb-1.5 flex items-baseline justify-between px-0.5">
                  <h3 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">
                    {periodLabel(p.period, periodsPerYear)}
                  </h3>
                  <span
                    className={cn(
                      'tabular text-[13px] font-semibold',
                      p.average === null
                        ? 'text-ink-faint'
                        : parcial
                          ? 'text-ink-muted'
                          : p.average >= passing
                            ? 'text-accent'
                            : 'text-danger',
                    )}
                  >
                    {p.average === null
                      ? 'sem notas'
                      : sum && p.over_limit
                        ? `nota ${fmtGrade(p.average)} de ${fmtGrade(gradeMax)}`
                        : sum
                          ? `soma ${fmtGrade(p.average)}${launched !== null ? ` de ${fmtGrade(launched)}` : ''}`
                          : `média ${fmtGrade(p.average)}`}
                  </span>
                </div>

                <Card padded={false} className="overflow-hidden">
                  <ul className="divide-y divide-line">
                    <AnimatePresence initial={false}>
                      {p.grades.map((g) => (
                        <m.li key={g.id} layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                          <button
                            type="button"
                            onClick={() => setGradeSheet({ open: true, grade: g })}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-elevated"
                          >
                            <span className="min-w-0 flex-1 truncate text-[15px]">{g.title ?? 'Nota'}</span>
                            {!sum && g.weight !== 1 && <span className="shrink-0 text-[12px] text-ink-faint">peso {fmtGrade(g.weight)}</span>}
                            <span
                              className={cn(
                                'tabular shrink-0 text-[16px] font-semibold',
                                // Na soma, 5 numa prova que vale 6 é boa nota: nada de vermelho.
                                sum || g.value >= passing ? 'text-ink' : 'text-danger',
                              )}
                            >
                              {fmtGrade(g.value)}
                              {sum && g.max_points !== null && (
                                <span className="ml-1 text-[12px] font-normal text-ink-faint">de {fmtGrade(g.max_points)}</span>
                              )}
                            </span>
                          </button>
                        </m.li>
                      ))}
                    </AnimatePresence>
                    <li>
                      <button
                        type="button"
                        onClick={() => setGradeSheet({ open: true, period: p.period })}
                        className="w-full px-4 py-2.5 text-left text-[14px] font-semibold text-accent transition-colors hover:bg-elevated"
                      >
                        + Lançar nota
                      </button>
                    </li>
                  </ul>
                </Card>

                {sum && p.over_limit && p.average !== null ? (
                  <p className="mt-2 px-0.5 text-[12px] leading-relaxed text-ink-faint">
                    {valiaBruta !== null
                      ? `As atividades somam ${fmtGrade(bruto)} de ${fmtGrade(valiaBruta)} pontos — passa do limite de ${fmtGrade(gradeMax)}, então a nota é a proporção: ${fmtGrade(p.average)}.`
                      : `Somam ${fmtGrade(bruto)} pontos em ${p.grades.length} atividades — passa do limite de ${fmtGrade(gradeMax)}, então a nota é a média: ${fmtGrade(p.average)}.`}
                  </p>
                ) : (
                  sum &&
                  launched !== null &&
                  p.average !== null && (
                    <p className="mt-2 px-0.5 text-[12px] text-ink-faint">
                      {parcial
                        ? `Lançados ${fmtGrade(launched)} pontos dos que a escola vai dar. Nos lançados, você tem ${Math.round((p.average / launched) * 100)}%.`
                        : `Trimestre fechado em ${fmtGrade(p.average)} de ${fmtGrade(launched)}.`}
                    </p>
                  )
                )}
              </section>
            )}

            <p className={cn('text-[13px]', statusTone(subject.status))}>{neededText(subject, periodsPerYear, passing)}</p>
          </div>
        )}
      </Sheet>
      {subject && (
        <GradeSheet
          open={gradeSheet.open}
          onClose={() => setGradeSheet({ open: false })}
          subjectId={subject.subject_id}
          subjectName={subject.name}
          year={year}
          period={gradeSheet.period ?? period}
          grade={gradeSheet.grade}
        />
      )}
    </>
  )
}

/** Modo "nota final": um campo por trimestre, salvando ao sair do campo. */
function FinalGradeRow({
  subjectId,
  year,
  period,
  periodsPerYear,
  passing,
  onOpenItems,
}: {
  subjectId: string
  year: number
  period: PeriodGrades
  periodsPerYear: number
  passing: number
  onOpenItems: () => void
}) {
  const create = useCreateGrade()
  const update = useUpdateGrade()
  const only = period.grades.length === 1 ? period.grades[0]! : null
  const [value, setValue] = useState(only ? fmtGrade(only.value) : '')
  const [error, setError] = useState<string | null>(null)

  // Mais de uma avaliação lançada: não dá para resumir num campo só sem apagar nada.
  if (period.grades.length > 1) {
    return (
      <button
        type="button"
        onClick={onOpenItems}
        className="flex items-center justify-between gap-3 rounded-md border border-line-strong bg-elevated px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[14px]">{periodLabel(period.period, periodsPerYear)}</span>
          <span className="block text-[12px] text-ink-faint">
            {period.grades.length} avaliações lançadas · troque para "Por avaliações" para ver
          </span>
        </span>
        <span className={cn('tabular shrink-0 text-[18px] font-semibold', (period.average ?? 0) >= passing ? 'text-accent' : 'text-danger')}>
          {fmtGrade(period.average)}
        </span>
      </button>
    )
  }

  function commit() {
    const parsed = parseGrade(value)
    setError(null)
    if (value.trim() === '' || parsed === null) return
    if (only) {
      if (parsed !== only.value) update.mutate({ id: only.id, value: parsed }, { onError: (e) => setError(errorMessage(e)) })
      return
    }
    create.mutate(
      { subject_id: subjectId, year, period: period.period, value: parsed, title: null },
      { onError: (e) => setError(errorMessage(e)) },
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center justify-between gap-3 rounded-md border border-line-strong bg-elevated px-4 py-2.5">
        <span className="text-[14px] text-ink-muted">{periodLabel(period.period, periodsPerYear)}</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="—"
          aria-label={`Nota do ${periodLabel(period.period, periodsPerYear)}`}
          className="tabular w-24 bg-transparent text-right text-[20px] font-semibold outline-none placeholder:text-ink-faint"
        />
      </label>
      {error && <p className="px-1 text-[12px] text-danger">{error}</p>}
    </div>
  )
}

/** Régua da escola: média mínima, períodos, escala, como fecha a nota e áreas. */
function GradeSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Régua da escola">
      <GradeSettingsForm key={String(open)} onClose={onClose} />
    </Sheet>
  )
}

function GradeSettingsForm({ onClose }: { onClose: () => void }) {
  const settings = useAuth((s) => s.user!.settings)
  const update = useUpdateGradeSettings()
  const [passing, setPassing] = useState(fmtGrade(settings.passing_grade))
  const [periods, setPeriods] = useState(settings.periods_per_year)
  const [max, setMax] = useState(settings.grade_max)
  const [mode, setMode] = useState<'weighted' | 'sum'>(settings.grade_mode)
  const [byArea, setByArea] = useState(settings.grades_by_area)
  const [error, setError] = useState<string | null>(null)
  const parsed = parseGrade(passing)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (parsed === null || parsed < 0 || parsed > max) return setError(`A média mínima vai de 0 a ${fmtGrade(max)}.`)
    try {
      await update.mutateAsync({
        passing_grade: parsed,
        periods_per_year: periods,
        grade_max: max,
        grade_mode: mode,
        grades_by_area: byArea,
      })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Escala de notas</span>
        <div className="flex gap-2" role="radiogroup" aria-label="Escala">
          {[10, 100].map((m) => (
            <Chip key={m} active={max === m} onClick={() => setMax(m)}>
              0 a {m}
            </Chip>
          ))}
        </div>
      </div>
      <Field
        label="Média mínima para passar"
        inputMode="decimal"
        value={passing}
        onChange={(e) => setPassing(e.target.value)}
        className="[&_input]:tabular"
        hint="A da sua escola. Padrão 6."
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Períodos no ano</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Períodos no ano">
          {[2, 3, 4].map((n) => (
            <Chip key={n} active={periods === n} onClick={() => setPeriods(n)}>
              {n} {periodsName(n)}
            </Chip>
          ))}
        </div>
        <p className="text-[13px] text-ink-faint">A média do ano é a média simples dos períodos.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Como a nota do período fecha</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Como a nota fecha">
          <Chip active={mode === 'weighted'} onClick={() => setMode('weighted')}>
            Média ponderada
          </Chip>
          <Chip active={mode === 'sum'} onClick={() => setMode('sum')}>
            Soma de pontos
          </Chip>
        </div>
        <p className="text-[13px] text-ink-faint">
          {mode === 'sum'
            ? 'Cada avaliação vale pontos e a nota é a soma: prova 5,5 + trabalho 4,0 = 9,5. Se passar do limite (duas atividades de 10), vira a média: 10 + 10 = 10.'
            : 'Cada avaliação tem um peso: prova 8,0 (peso 2) e trabalho 10,0 (peso 1) = 8,7.'}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-line-strong bg-elevated px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px]">Agrupar por área</p>
            <p className="text-[12px] text-ink-faint">
              A nota da área é a média das matérias dela. As quatro do ENEM já vêm prontas.
            </p>
          </div>
          <Toggle label="Agrupar notas por área" checked={byArea} onChange={setByArea} />
        </div>
        {byArea && (
          <p className="text-[12px] text-ink-faint">As áreas você cria e organiza na própria tela de notas.</p>
        )}
      </div>
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <Button type="submit" size="lg" full loading={update.isPending} disabled={parsed === null}>
        Salvar
      </Button>
    </form>
  )
}
