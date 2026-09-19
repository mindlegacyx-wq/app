import { api } from '@/lib/api'
import type { PushStatus } from '@/lib/types'

/**
 * Web Push neste aparelho. O estado é do navegador (permissão + assinatura no service worker);
 * o servidor só guarda a assinatura para enviar o alarme.
 */

export type PushDeviceState =
  | 'unsupported' // navegador sem push (ou fora de HTTPS)
  | 'server_off' // servidor sem chaves VAPID: push desligado nesta instalação
  | 'denied' // usuário bloqueou notificações no navegador
  | 'off' // suportado e permitido (ou ainda não perguntado), mas sem assinatura
  | 'on' // assinatura ativa neste aparelho

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    window.isSecureContext
  )
}

/** iOS só entrega push com o app instalado na tela inicial. */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone))
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

export async function getPushDeviceState(status: PushStatus | undefined): Promise<PushDeviceState> {
  if (!pushSupported()) return 'unsupported'
  if (status && !status.enabled) return 'server_off'
  if (Notification.permission === 'denied') return 'denied'
  try {
    return (await currentSubscription()) ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export class PushError extends Error {}

/** Pede permissão (se preciso), assina no navegador e registra no servidor. */
export async function enablePush(publicKey: string): Promise<void> {
  if (!pushSupported()) throw new PushError('Este navegador não recebe notificações.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new PushError('Permissão negada. Libere as notificações nas configurações do navegador.')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new PushError('Assinatura de push incompleta.')
  await api('/users/me/push/subscriptions', {
    method: 'POST',
    body: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
  })
}

/** Cancela a assinatura deste aparelho no navegador e no servidor. */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await api(`/users/me/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`, { method: 'DELETE' })
}
