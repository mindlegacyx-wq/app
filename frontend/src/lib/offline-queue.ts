import { create } from 'zustand'

/**
 * Fila local de ações feitas sem conexão.
 *
 * Só entram aqui escritas idempotentes e pequenas (marcar/desmarcar item de rotina, tarefa,
 * ação de meta, exercício). A UI já aplicou a mudança de forma otimista; quando a rede volta,
 * a fila é reenviada em ordem e as consultas são recarregadas para o servidor voltar a ser a
 * verdade. Criar/editar não entra na fila: o risco de conflito não compensa no MVP.
 */

export interface QueuedRequest {
  id: string
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  path: string
  body?: unknown
  queuedAt: string
}

const STORAGE_KEY = 'disciplina.offline-queue'

function load(): QueuedRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QueuedRequest[]) : []
  } catch {
    return []
  }
}

function save(items: QueuedRequest[]) {
  try {
    if (items.length === 0) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* sem storage: a fila vive só em memória */
  }
}

interface OfflineState {
  online: boolean
  items: QueuedRequest[]
  flushing: boolean
  setOnline: (online: boolean) => void
  enqueue: (req: Omit<QueuedRequest, 'id' | 'queuedAt'>) => void
  /** Reenvia a fila em ordem. Para no primeiro erro de rede; descarta respostas 4xx. */
  flush: (send: (req: QueuedRequest) => Promise<void>) => Promise<number>
}

export const useOffline = create<OfflineState>((set, get) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  items: load(),
  flushing: false,

  setOnline: (online) => set({ online }),

  enqueue: (req) => {
    const item: QueuedRequest = {
      ...req,
      id: crypto.randomUUID(),
      queuedAt: new Date().toISOString(),
    }
    // Duas ações no mesmo alvo: a última vence (marcar e desmarcar o mesmo item).
    const items = [...get().items.filter((i) => !(i.path === item.path && i.method === item.method)), item]
    save(items)
    set({ items })
  },

  async flush(send) {
    if (get().flushing || get().items.length === 0) return 0
    set({ flushing: true })
    let sent = 0
    try {
      while (get().items.length > 0) {
        const next = get().items[0]!
        try {
          await send(next)
          sent += 1
        } catch (err) {
          if (isNetworkError(err)) break // ainda sem rede: tenta depois
          // Erro do servidor para esta ação (dia fechado, item excluído…): descarta e segue.
          console.warn('ação pendente descartada', next.method, next.path, err)
        }
        const items = get().items.slice(1)
        save(items)
        set({ items })
      }
    } finally {
      set({ flushing: false })
    }
    return sent
  },
}))

export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine)
}
