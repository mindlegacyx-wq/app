import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { Button, Card, EmptyState, Spinner } from '@/components/ui'
import { api, errorMessage } from '@/lib/api'
import { dateTime } from '@/lib/format'

interface TrashItem {
  kind: string
  label: string
  id: string
  title: string
  subtitle: string | null
  deleted_at: string
  expires_at: string
}

interface Trash {
  retention_days: number
  items: TrashItem[]
}

/** Tela 26: itens excluídos nos últimos 30 dias, agrupados por tipo, com restaurar. */
export function TrashPage() {
  const qc = useQueryClient()
  const trash = useQuery({ queryKey: ['trash'], queryFn: () => api<Trash>('/trash') })
  const [error, setError] = useState<string | null>(null)
  const restore = useMutation({
    mutationFn: (item: TrashItem) => api('/trash/restore', { method: 'POST', body: { kind: item.kind, id: item.id } }),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries() // o item volta para a lista do módulo dono
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const groups = new Map<string, TrashItem[]>()
  for (const item of trash.data?.items ?? []) {
    const list = groups.get(item.label) ?? []
    list.push(item)
    groups.set(item.label, list)
  }

  return (
    <div className="safe-top pt-2 pb-10">
      <header className="flex h-12 items-center gap-3">
        <Link to="/configuracoes" aria-label="Voltar" className="-ml-2 flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Lixeira</h1>
      </header>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[14px] text-danger">
          {error}
        </p>
      )}

      {trash.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-ink-faint" />
        </div>
      ) : trash.isError ? (
        <EmptyState className="mt-6" title="Não foi possível carregar" description={errorMessage(trash.error)} />
      ) : groups.size === 0 ? (
        <EmptyState className="mt-6" title="Lixeira vazia" description={`O que você excluir fica aqui por ${trash.data.retention_days} dias e pode ser restaurado.`} />
      ) : (
        <>
          <p className="mt-3 px-0.5 text-[13px] leading-relaxed text-ink-faint">
            Itens ficam aqui por {trash.data.retention_days} dias. Depois são apagados em definitivo — o histórico de dias já fechados não muda.
          </p>
          {[...groups.entries()].map(([label, items]) => (
            <section key={label} className="mt-6">
              <h2 className="mb-2 px-0.5 text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">
                {label} · {items.length}
              </h2>
              <Card padded={false} className="divide-y divide-line overflow-hidden">
                {items.map((item) => (
                  <div key={`${item.kind}-${item.id}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px]">{item.title}</p>
                      <p className="truncate text-[12px] text-ink-faint">
                        {item.subtitle ? `${item.subtitle} · ` : ''}excluído {dateTime(item.deleted_at)} · {expiresIn(item.expires_at)}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" loading={restore.isPending && restore.variables?.id === item.id} onClick={() => restore.mutate(item)}>
                      Restaurar
                    </Button>
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </>
      )}
    </div>
  )
}

function expiresIn(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (days <= 0) return 'expira hoje'
  if (days === 1) return 'expira amanhã'
  return `expira em ${days} dias`
}
