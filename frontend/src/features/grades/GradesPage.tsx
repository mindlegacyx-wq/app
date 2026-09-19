import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Button, Card, Chip, EmptyState, Field, Sheet, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, pluralize } from '@/lib/format'
import type { Grade, SubjectGrades } from '@/lib/types'

import { GradeSheet } from './GradeSheet'
import { useGrades, useUpdateGradeSettings } from './api'
import { fmtGrade, parseGrade, periodLabel, periodsName, statusLabel, statusTone } from './shared'

/** Tela 36: notas por matéria e período, média do ano e "quanto preciso tirar". */
export function GradesPage() {
  const [year, setYear] = useState<number | null>(null)
  const grades = useGrades(year)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [detail, setDetail] = useState<SubjectGrades | null>(null)

  const data = grades.data
  // Mantém o detalhe aberto sincronizado com a última leitura.
  const current = detail ? (data?.subjects.find((s) => s.subject_id === detail.subject_id) ?? null) : null

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
            Média mínima <span className="font-semibold text-ink-muted">{fmtGrade(data!.passing_grade)}</span> · {data!.periods_per_year}{' '}
            {periodsName(data!.periods_per_year)} · escala até {fmtGrade(data!.grade_max)}
          </p>

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
          open={current !== null}
          subject={current}
          year={data.year}
          periodsPerYear={data.periods_per_year}
          passing={data.passing_grade}
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

function SubjectSheet({
  open,
  subject,
  year,
  periodsPerYear,
  passing,
  onClose,
}: {
  open: boolean
  subject: SubjectGrades | null
  year: number
  periodsPerYear: number
  passing: number
  onClose: () => void
}) {
  const [gradeSheet, setGradeSheet] = useState<{ open: boolean; period?: number; grade?: Grade }>({ open: false })
  return (
    <>
      <Sheet open={open} onClose={onClose} title={subject?.name ?? 'Matéria'}>
        {subject && (
          <div className="flex flex-col gap-4">
            <p className={cn('text-[14px]', statusTone(subject.status))}>{neededText(subject, periodsPerYear, passing)}</p>
            {subject.periods.map((p) => (
              <section key={p.period}>
                <div className="mb-1.5 flex items-baseline justify-between px-0.5">
                  <h3 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">
                    {periodLabel(p.period, periodsPerYear)}
                  </h3>
                  <span
                    className={cn(
                      'tabular text-[13px] font-semibold',
                      p.average === null ? 'text-ink-faint' : p.average >= passing ? 'text-accent' : 'text-danger',
                    )}
                  >
                    {p.average === null ? 'sem notas' : `média ${fmtGrade(p.average)}`}
                  </span>
                </div>
                <Card padded={false} className="overflow-hidden">
                  <ul className="divide-y divide-line">
                    {p.grades.map((g) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => setGradeSheet({ open: true, grade: g })}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-elevated"
                        >
                          <span className="min-w-0 flex-1 truncate text-[15px]">{g.title ?? 'Nota'}</span>
                          {g.weight !== 1 && <span className="shrink-0 text-[12px] text-ink-faint">peso {fmtGrade(g.weight)}</span>}
                          <span
                            className={cn('tabular shrink-0 text-[16px] font-semibold', g.value >= passing ? 'text-ink' : 'text-danger')}
                          >
                            {fmtGrade(g.value)}
                          </span>
                        </button>
                      </li>
                    ))}
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
              </section>
            ))}
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
          period={gradeSheet.period}
          grade={gradeSheet.grade}
        />
      )}
    </>
  )
}

/** Régua da escola: média mínima, quantos períodos e a escala. */
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
  const [error, setError] = useState<string | null>(null)
  const parsed = parseGrade(passing)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (parsed === null || parsed < 0 || parsed > max) return setError(`A média mínima vai de 0 a ${fmtGrade(max)}.`)
    try {
      await update.mutateAsync({ passing_grade: parsed, periods_per_year: periods, grade_max: max })
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
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <Button type="submit" size="lg" full loading={update.isPending} disabled={parsed === null}>
        Salvar
      </Button>
    </form>
  )
}
