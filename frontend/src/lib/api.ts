/**
 * Cliente HTTP da API.
 *
 * - Access token fica só em memória (nunca em localStorage).
 * - O refresh token vive num cookie httpOnly; em 401 tentamos renovar uma vez e repetimos a chamada.
 * - Erros da API viram ApiError com code/message/details prontos para a UI.
 */

import { isNetworkError, useOffline } from './offline-queue'
import type { ApiErrorBody, TokenResponse, User } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiErrorBody['error']['details']

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message)
    this.status = status
    this.code = body.code
    this.details = body.details ?? {}
  }

  fieldError(field: string): string | undefined {
    return this.details.fields?.find((f) => f.field === field)?.message
  }
}

type Listener = (state: { token: string | null; user: User | null }) => void

let accessToken: string | null = null
let refreshing: Promise<boolean> | null = null
const listeners = new Set<Listener>()

export function onSessionChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit(token: string | null, user: User | null) {
  for (const fn of listeners) fn({ token, user })
}

export function setSession(data: TokenResponse | null) {
  accessToken = data?.access_token ?? null
  emit(accessToken, data?.user ?? null)
}

export function hasAccessToken(): boolean {
  return accessToken !== null
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody
    if (body?.error) return new ApiError(res.status, body.error)
  } catch {
    /* corpo não é JSON */
  }
  return new ApiError(res.status, {
    code: 'http_error',
    message: res.status >= 500 ? 'O servidor não respondeu. Tente de novo.' : 'Algo deu errado.',
    details: {},
  })
}

/** Renova a sessão usando o cookie de refresh. Uma renovação por vez. */
export async function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
      if (!res.ok) {
        setSession(null)
        return false
      }
      setSession((await res.json()) as TokenResponse)
      return true
    } catch {
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** false para rotas públicas (login, cadastro) */
  auth?: boolean
  signal?: AbortSignal
  /**
   * Sem conexão, guarda a escrita na fila local e resolve como sucesso (sem corpo). Só para
   * ações idempotentes já aplicadas de forma otimista na UI (checks).
   */
  queue?: boolean
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal, queue = false } = opts

  if (queue && method !== 'GET' && !navigator.onLine) {
    useOffline.getState().enqueue({ method, path, body })
    return undefined as T
  }

  const doFetch = () =>
    fetch(`/api/v1${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

  let res: Response
  try {
    res = await doFetch()
  } catch (err) {
    if (queue && method !== 'GET' && isNetworkError(err)) {
      useOffline.getState().enqueue({ method, path, body })
      return undefined as T
    }
    throw err
  }

  if (res.status === 401 && auth) {
    const renewed = await refreshSession()
    if (!renewed) throw await parseError(res)
    res = await doFetch()
  }

  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Envio de arquivos (multipart). Mesmo tratamento de sessão do `api`. */
export async function apiUpload<T>(path: string, form: FormData, signal?: AbortSignal): Promise<T> {
  const doFetch = () =>
    fetch(`/api/v1${path}`, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    })
  let res = await doFetch()
  if (res.status === 401) {
    const renewed = await refreshSession()
    if (!renewed) throw await parseError(res)
    res = await doFetch()
  }
  if (!res.ok) throw await parseError(res)
  return (await res.json()) as T
}

/** Mensagem legível para qualquer erro capturado na UI. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof TypeError) return 'Sem conexão. Verifique a internet e tente de novo.'
  return 'Algo deu errado. Tente de novo.'
}

/** Reenvia a fila offline (chamado ao voltar a conexão e ao abrir o app). */
export function flushOfflineQueue(): Promise<number> {
  return useOffline.getState().flush((req) => api(req.path, { method: req.method, body: req.body }))
}
