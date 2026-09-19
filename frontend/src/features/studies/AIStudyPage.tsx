import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'

import { Button, Card, EmptyState, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn, dateTime, pluralize } from '@/lib/format'
import { renderMarkdown } from '@/lib/markdown'
import type { ArtifactKind, MindMapNode, QuizQuestion } from '@/lib/types'

import { useExam } from './api'
import { useExamAI, useGenerate } from './ai-api'
import { ARTIFACT_KINDS, artifactLabel } from './ai-shared'

/** Tela 38: leitura de um material gerado — teoria/resoluções (markdown), mapa mental, quiz. */
export function AIStudyPage() {
  const { id: examId = '', kind = '' } = useParams()
  const valid = (ARTIFACT_KINDS as string[]).includes(kind)
  const state = useExamAI(examId)
  const exam = useExam(examId)
  const generate = useGenerate(examId)
  const [error, setError] = useState<string | null>(null)

  const artifact = state.data?.artifacts.find((a) => a.kind === kind)

  if (!valid) {
    return (
      <div className="safe-top pt-2">
        <Header examId={examId} title="Material" />
        <EmptyState className="mt-6" title="Material inválido" />
      </div>
    )
  }
  if (state.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6 text-ink-faint" />
      </div>
    )
  }
  if (state.isError || !artifact) {
    return (
      <div className="safe-top pt-2">
        <Header examId={examId} title={artifactLabel[kind as ArtifactKind]} />
        <EmptyState className="mt-6" title="Não foi possível carregar" description={state.error ? errorMessage(state.error) : undefined} />
      </div>
    )
  }

  const k = kind as ArtifactKind
  const busy = artifact.status === 'running' || (artifact.status === 'queued' && artifact.updated_at !== null)

  return (
    <div className="safe-top pt-2 pb-10">
      <Header examId={examId} title={artifactLabel[k]} subtitle={exam.data?.title} />

      {(artifact.stale || artifact.status === 'failed') && (
        <Card
          className={cn(
            'mt-3 flex items-center justify-between gap-3',
            artifact.status === 'failed' ? 'border-danger/30' : 'border-warning/30',
          )}
        >
          <p className="text-[13px] text-ink-muted">
            {artifact.status === 'failed' ? (artifact.error ?? 'A geração falhou.') : 'Os materiais mudaram depois desta geração.'}
          </p>
          <Button
            size="sm"
            variant="secondary"
            loading={busy || generate.isPending}
            onClick={() => generate.mutate([k], { onError: (e) => setError(errorMessage(e)) })}
          >
            Gerar de novo
          </Button>
        </Card>
      )}
      {error && <p className="mt-2 text-[14px] text-danger">{error}</p>}

      {busy && artifact.status !== 'done' ? (
        <Card className="mt-4 flex flex-col items-center gap-3 py-10 text-center">
          <Spinner className="size-6 text-ink-faint" />
          <p className="text-[14px] text-ink-muted">Gerando… pode levar até um minuto.</p>
        </Card>
      ) : artifact.status !== 'done' ? (
        <EmptyState className="mt-4" title="Ainda não gerado" description="Volte à prova e toque em gerar." />
      ) : k === 'mindmap' ? (
        <MindMap root={artifact.content_json as MindMapNode} />
      ) : k === 'quiz' ? (
        <Quiz questions={(artifact.content_json as { questions: QuizQuestion[] }).questions} />
      ) : (
        <Markdown md={artifact.content_md ?? ''} />
      )}

      {artifact.status === 'done' && (
        <p className="mt-6 text-center text-[11px] text-ink-faint">
          Gerado por IA{artifact.model ? ` (${artifact.model})` : ''}
          {artifact.updated_at ? ` em ${dateTime(artifact.updated_at)}` : ''}. Confira com o material da professora.
        </p>
      )}
    </div>
  )
}

function Markdown({ md }: { md: string }) {
  const html = useMemo(() => renderMarkdown(md), [md])
  return <Card className="prose-ai mt-3" dangerouslySetInnerHTML={{ __html: html }} />
}

// --- Mapa mental -------------------------------------------------------------------------

const LEVEL_COLORS = ['#C6F135', '#5AC8FA', '#FF9F43', '#B57BFF']

function MindMap({ root }: { root: MindMapNode }) {
  return (
    <div className="mt-3">
      <Card className="border-accent/40 bg-accent-soft/30 text-center">
        <p className="text-[18px] font-semibold tracking-[-0.01em]">{root.title}</p>
        {root.note && <p className="mt-1 text-[13px] text-ink-muted">{root.note}</p>}
      </Card>
      <ul className="mt-2 flex flex-col gap-2">
        {root.children.map((c, i) => (
          <Branch key={i} node={c} level={1} />
        ))}
      </ul>
    </div>
  )
}

function Branch({ node, level }: { node: MindMapNode; level: number }) {
  const [open, setOpen] = useState(true)
  const color = LEVEL_COLORS[level % LEVEL_COLORS.length]!
  const hasChildren = node.children.length > 0
  return (
    <li>
      <button
        type="button"
        onClick={() => hasChildren && setOpen((v) => !v)}
        aria-expanded={hasChildren ? open : undefined}
        className={cn(
          'flex w-full items-start gap-3 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-left',
          hasChildren && 'transition-colors hover:bg-elevated',
        )}
        style={{ borderLeftWidth: 3, borderLeftColor: color }}
      >
        <span className="min-w-0 flex-1">
          <span className={cn('block', level === 1 ? 'text-[15px] font-semibold' : 'text-[14px]')}>{node.title}</span>
          {node.note && <span className="block text-[12px] text-ink-faint">{node.note}</span>}
        </span>
        {hasChildren && (
          <svg
            className={cn('mt-1 size-4 shrink-0 text-ink-faint transition-transform', open && 'rotate-90')}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>
      {hasChildren && open && (
        <ul className="mt-1.5 ml-4 flex flex-col gap-1.5 border-l border-line pl-3">
          {node.children.map((c, i) => (
            <Branch key={i} node={c} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

// --- Quiz --------------------------------------------------------------------------------

function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const q = questions[index]!
  const letters = ['A', 'B', 'C', 'D', 'E']

  function choose(i: number) {
    if (picked !== null) return
    setPicked(i)
    if (i === q.answer) setScore((s) => s + 1)
  }

  function next() {
    if (index + 1 >= questions.length) {
      setFinished(true)
      return
    }
    setIndex((i) => i + 1)
    setPicked(null)
  }

  function restart() {
    setIndex(0)
    setPicked(null)
    setScore(0)
    setFinished(false)
  }

  if (finished) {
    const pct = Math.round((score * 100) / questions.length)
    return (
      <Card className="mt-3 flex flex-col items-center py-8 text-center">
        <p className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Resultado</p>
        <p className={cn('tabular mt-2 text-[44px] leading-none font-semibold tracking-[-0.03em]', pct >= 70 ? 'text-accent' : 'text-ink')}>
          {pct}%
        </p>
        <p className="mt-2 text-[14px] text-ink-muted">
          {score} de {questions.length} certas
        </p>
        <p className="mt-3 max-w-xs text-[13px] text-ink-faint">
          {pct === 100
            ? 'Tudo certo. Agora é manter.'
            : pct >= 70
              ? 'Bom sinal. Revise as que errou nas resoluções.'
              : 'Volte na teoria e nas resoluções e refaça amanhã.'}
        </p>
        <Button className="mt-6" onClick={restart}>
          Refazer o quiz
        </Button>
      </Card>
    )
  }

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between px-0.5 text-[12px] text-ink-faint">
        <span>
          Questão {index + 1} de {questions.length}
        </span>
        <span className="tabular">{pluralize(score, 'certa', 'certas')}</span>
      </div>
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${((index + (picked !== null ? 1 : 0)) * 100) / questions.length}%` }}
        />
      </div>
      <Card>
        <p className="text-[16px] leading-relaxed font-medium">{q.question}</p>
        <ul className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="Alternativas">
          {q.options.map((opt, i) => {
            const isPicked = picked === i
            const isAnswer = q.answer === i
            const state = picked === null ? 'idle' : isAnswer ? 'correct' : isPicked ? 'wrong' : 'muted'
            return (
              <li key={i}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isPicked}
                  disabled={picked !== null}
                  onClick={() => choose(i)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left text-[15px] transition-colors',
                    state === 'idle' && 'border-line-strong bg-elevated hover:border-ink-faint',
                    state === 'correct' && 'border-accent bg-accent-soft text-ink',
                    state === 'wrong' && 'border-danger/60 bg-danger-soft text-ink',
                    state === 'muted' && 'border-line text-ink-faint',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold',
                      state === 'correct'
                        ? 'border-accent bg-accent text-on-accent'
                        : state === 'wrong'
                          ? 'border-danger text-danger'
                          : 'border-line-strong text-ink-muted',
                    )}
                  >
                    {letters[i]}
                  </span>
                  <span className="min-w-0 flex-1">{opt}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {picked !== null && (
          <div
            className={cn(
              'mt-4 rounded-lg px-3.5 py-3 text-[14px] leading-relaxed',
              picked === q.answer ? 'bg-accent-soft/60 text-ink' : 'bg-danger-soft/60 text-ink',
            )}
          >
            <p className="font-semibold">{picked === q.answer ? 'Certa.' : `Errou. A correta é ${letters[q.answer]}.`}</p>
            {q.explanation && <p className="mt-1 text-ink-muted">{q.explanation}</p>}
          </div>
        )}
        {picked !== null && (
          <Button size="lg" full className="mt-4" onClick={next}>
            {index + 1 >= questions.length ? 'Ver resultado' : 'Próxima'}
          </Button>
        )}
      </Card>
    </div>
  )
}

function Header({ examId, title, subtitle }: { examId: string; title: string; subtitle?: string }) {
  return (
    <header className="flex h-12 items-center gap-3">
      <Link
        to={`/estudos/${examId}`}
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
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[20px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="truncate text-[12px] text-ink-faint">{subtitle}</p>}
      </div>
    </header>
  )
}
