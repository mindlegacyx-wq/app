import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Button, Card, Dialog, Field, Sheet, Spinner } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/format'
import type { StudyArtifact, StudyMaterial } from '@/lib/types'

import { useAddMaterial, useDeleteMaterial, useExamAI, useGenerate, useTranscribe, useUpdateMaterial } from './ai-api'
import { artifactHint, artifactLabel, materialTitle } from './ai-shared'

/**
 * Seção "Estudar com IA" da tela da prova: materiais (fotos transcritas ou texto) e os quatro
 * materiais gerados. Sem IA configurada, os materiais em texto continuam funcionando.
 */
export function AISection({ examId }: { examId: string }) {
  const state = useExamAI(examId)
  const transcribe = useTranscribe(examId)
  const generate = useGenerate(examId)
  const fileInput = useRef<HTMLInputElement>(null)
  const [review, setReview] = useState<{ open: boolean; content: string; images: number }>({ open: false, content: '', images: 0 })
  const [materialSheet, setMaterialSheet] = useState<{ open: boolean; material?: StudyMaterial }>({ open: false })
  const [error, setError] = useState<string | null>(null)

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setError(null)
    try {
      const r = await transcribe.mutateAsync(files)
      setReview({ open: true, content: r.content, images: r.images })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const d = state.data
  const busy = d?.artifacts.some((a) => a.status === 'running') ?? false
  const anyDone = d?.artifacts.some((a) => a.status === 'done') ?? false

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between px-0.5">
        <h2 className="text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Estudar com IA</h2>
        {d && d.materials.length > 0 && (
          <span className="text-[12px] text-ink-muted">{d.materials.length === 1 ? '1 material' : `${d.materials.length} materiais`}</span>
        )}
      </div>

      {state.isPending ? (
        <Card className="flex h-14 items-center justify-center">
          <Spinner className="size-5 text-ink-faint" />
        </Card>
      ) : state.isError || !d ? (
        <Card className="text-[14px] text-ink-muted">{state.error ? errorMessage(state.error) : 'Não foi possível carregar.'}</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {!d.configured && (
            <Card className="border-warning/30">
              <p className="text-[15px] font-semibold text-warning">IA não configurada neste servidor</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                Quem administra o app precisa preencher <code className="rounded bg-elevated px-1 text-[12px]">AI_API_KEY</code> no{' '}
                <code className="rounded bg-elevated px-1 text-[12px]">.env</code> (qualquer provedor compatível com a API da OpenAI — Groq
                e Gemini têm plano gratuito). Enquanto isso, dá para guardar os exercícios em texto.
              </p>
            </Card>
          )}

          {d.materials.length === 0 ? (
            <p className="px-0.5 text-[13px] text-ink-faint">
              Tire fotos dos exercícios que a professora passou. A IA transcreve, você confere o texto e ela monta teoria, resoluções, mapa
              mental e quiz em cima deles. As fotos não ficam guardadas.
            </p>
          ) : (
            <Card padded={false} className="overflow-hidden">
              <ul className="divide-y divide-line">
                {d.materials.map((m, i) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setMaterialSheet({ open: true, material: m })}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-elevated"
                    >
                      <span className="text-ink-faint" aria-hidden>
                        {m.source === 'photo' ? <PhotoIcon /> : <TextIcon />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px]">{materialTitle(m, i)}</span>
                        <span className="block truncate text-[12px] text-ink-faint">
                          {m.content
                            .replace(/[#*_`>\n]+/g, ' ')
                            .trim()
                            .slice(0, 90)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="sr-only"
              onChange={(e) => void onFiles(e)}
              aria-label="Selecionar fotos"
            />
            <Button
              variant="secondary"
              full
              loading={transcribe.isPending}
              disabled={!d.configured}
              onClick={() => fileInput.current?.click()}
              icon={<PhotoIcon />}
            >
              {transcribe.isPending ? 'Lendo as fotos…' : 'Tirar fotos'}
            </Button>
            <Button variant="secondary" full onClick={() => setMaterialSheet({ open: true })} icon={<TextIcon />}>
              Colar texto
            </Button>
          </div>

          {error && <p className="text-[14px] text-danger">{error}</p>}

          <div className="grid grid-cols-2 gap-2">
            {d.artifacts.map((a) => (
              <ArtifactCard
                key={a.kind}
                examId={examId}
                a={a}
                canGenerate={d.can_generate}
                onGenerate={() => generate.mutate([a.kind], { onError: (e) => setError(errorMessage(e)) })}
              />
            ))}
          </div>

          {d.can_generate && (
            <Button
              size="lg"
              full
              variant={anyDone ? 'secondary' : 'primary'}
              loading={generate.isPending || busy}
              onClick={() => generate.mutate(undefined, { onError: (e) => setError(errorMessage(e)) })}
            >
              {busy ? 'Gerando em segundo plano…' : anyDone ? 'Gerar tudo de novo' : 'Gerar estudo com IA'}
            </Button>
          )}
          {busy && (
            <p className="text-center text-[12px] text-ink-faint">
              Pode sair desta tela; os materiais aparecem aqui quando ficarem prontos.
            </p>
          )}
        </div>
      )}

      <TranscriptionSheet
        open={review.open}
        content={review.content}
        images={review.images}
        examId={examId}
        onClose={() => setReview((r) => ({ ...r, open: false }))}
        onRetake={() => {
          setReview((r) => ({ ...r, open: false }))
          fileInput.current?.click()
        }}
      />
      <MaterialSheet
        open={materialSheet.open}
        examId={examId}
        material={materialSheet.material}
        onClose={() => setMaterialSheet({ open: false })}
      />
    </section>
  )
}

function ArtifactCard({
  examId,
  a,
  canGenerate,
  onGenerate,
}: {
  examId: string
  a: StudyArtifact
  canGenerate: boolean
  onGenerate: () => void
}) {
  const never = a.status === 'queued' && a.updated_at === null
  const ready = a.status === 'done'
  const statusText =
    a.status === 'running'
      ? 'gerando…'
      : a.status === 'queued' && !never
        ? 'na fila'
        : a.status === 'failed'
          ? 'falhou'
          : ready
            ? a.stale
              ? 'desatualizado'
              : 'pronto'
            : canGenerate
              ? 'gerar'
              : '—'
  const body = (
    <Card
      className={cn(
        'flex h-full flex-col justify-between transition-colors',
        ready ? 'border-accent/30 hover:bg-elevated' : 'hover:bg-elevated',
        a.status === 'failed' && 'border-danger/30',
      )}
    >
      <div>
        <p className="text-[15px] font-semibold">{artifactLabel[a.kind]}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">
          {a.status === 'failed' && a.error ? a.error : artifactHint[a.kind]}
        </p>
      </div>
      <p
        className={cn(
          'mt-3 flex items-center gap-1.5 text-[12px] font-semibold',
          ready && !a.stale ? 'text-accent' : a.status === 'failed' ? 'text-danger' : a.stale ? 'text-warning' : 'text-ink-muted',
        )}
      >
        {a.status === 'running' && <Spinner className="size-3" />}
        {statusText}
      </p>
    </Card>
  )
  if (ready) {
    return (
      <Link to={`/estudos/${examId}/ia/${a.kind}`} className="block" aria-label={`${artifactLabel[a.kind]}: ${statusText}`}>
        {body}
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={onGenerate}
      disabled={!canGenerate || a.status === 'running'}
      className="block text-left disabled:cursor-default"
      aria-label={`${artifactLabel[a.kind]}: ${statusText}`}
    >
      {body}
    </button>
  )
}

/** Revisão da transcrição antes de salvar: o texto é o que fica; as fotos, não. */
function TranscriptionSheet({
  open,
  content,
  images,
  examId,
  onClose,
  onRetake,
}: {
  open: boolean
  content: string
  images: number
  examId: string
  onClose: () => void
  onRetake: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Confira a transcrição">
      <TranscriptionForm key={content} content={content} images={images} examId={examId} onClose={onClose} onRetake={onRetake} />
    </Sheet>
  )
}

function TranscriptionForm({
  content,
  images,
  examId,
  onClose,
  onRetake,
}: {
  content: string
  images: number
  examId: string
  onClose: () => void
  onRetake: () => void
}) {
  const add = useAddMaterial(examId)
  const [text, setText] = useState(content)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await add.mutateAsync({ title: title.trim() || null, source: 'photo', content: text })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-[13px] text-ink-muted">
        Lido de {images === 1 ? '1 foto' : `${images} fotos`}. Corrija o que a IA errou — só este texto é guardado.
      </p>
      <Field
        label="Nome (opcional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        placeholder="Ex.: Lista 3 · Exercícios do caderno"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        aria-label="Transcrição"
        className="w-full resize-y rounded-md border border-line-strong bg-elevated px-4 py-3 font-mono text-[13px] leading-relaxed outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
      />
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <Button type="submit" size="lg" full loading={add.isPending} disabled={!text.trim()}>
        Salvar material
      </Button>
      <Button type="button" variant="ghost" full onClick={onRetake}>
        Tirar outras fotos
      </Button>
    </form>
  )
}

/** Criar/editar um material em texto. */
function MaterialSheet({
  open,
  examId,
  material,
  onClose,
}: {
  open: boolean
  examId: string
  material?: StudyMaterial
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={material ? 'Material' : 'Colar texto'}>
      <MaterialForm key={material?.id ?? 'new'} examId={examId} material={material} onClose={onClose} />
    </Sheet>
  )
}

function MaterialForm({ examId, material, onClose }: { examId: string; material?: StudyMaterial; onClose: () => void }) {
  const add = useAddMaterial(examId)
  const update = useUpdateMaterial(examId)
  const remove = useDeleteMaterial(examId)
  const [title, setTitle] = useState(material?.title ?? '')
  const [text, setText] = useState(material?.content ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      if (material) {
        await update.mutateAsync({ id: material.id, title: title.trim() || null, clear_title: title.trim() === '', content: text })
      } else {
        await add.mutateAsync({ title: title.trim() || null, source: 'text', content: text })
      }
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Nome (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Ex.: Lista 3" />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        aria-label="Texto do material"
        placeholder={'Cole aqui os exercícios ou anotações.\n\n1) Resolva 2x − 4 = 0\n2) …'}
        className="w-full resize-y rounded-md border border-line-strong bg-elevated px-4 py-3 font-mono text-[13px] leading-relaxed outline-none placeholder:text-ink-faint focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
        autoFocus={!material}
      />
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <Button type="submit" size="lg" full loading={add.isPending || update.isPending} disabled={!text.trim()}>
        {material ? 'Salvar' : 'Adicionar material'}
      </Button>
      {material && (
        <Button type="button" variant="ghost" full className="text-danger" onClick={() => setConfirmDelete(true)}>
          Excluir material
        </Button>
      )}
      <Dialog
        open={confirmDelete}
        title="Excluir este material?"
        description="Os materiais já gerados continuam, mas ficam marcados como desatualizados."
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          material &&
          remove.mutate(material.id, {
            onSuccess: () => {
              setConfirmDelete(false)
              onClose()
            },
            onError: (e) => {
              setConfirmDelete(false)
              setError(errorMessage(e))
            },
          })
        }
      />
    </form>
  )
}

function PhotoIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  )
}

function TextIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 6h14M5 12h14M5 18h9" />
    </svg>
  )
}
