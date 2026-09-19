// (a lib WebWorker vem do tsconfig.sw.json; este arquivo fica fora do projeto do app)
/**
 * Service worker do Disciplina (estratégia injectManifest do vite-plugin-pwa).
 *
 * - Precache do app (assets do build) + fallback de navegação para o index.html.
 * - Última resposta de /users/me em cache (leitura offline do perfil).
 * - Web Push do despertador: mostra a notificação persistente e avisa a janela aberta, se
 *   houver, para ela abrir a tela de alarme na hora.
 *
 * A confirmação de "Levantei" nunca acontece pela notificação: o toque abre a tela de alarme,
 * onde o usuário segura 3 s. O atrito é proposital.
 */

import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

const ALARM_URL = '/alarme'

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// A API nunca passa pelo fallback de navegação nem pelo cache de assets.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }))

registerRoute(
  ({ url, request }) => request.method === 'GET' && /\/api\/v1\/users\/me$/.test(url.pathname),
  new NetworkFirst({
    cacheName: 'api-me',
    networkTimeoutSeconds: 4,
    plugins: [new ExpirationPlugin({ maxEntries: 1 })],
  }),
)

interface AlarmPayload {
  type: 'alarm'
  wake_log_id: string
  alarm_id: string
  label: string
  time: string
  sound: string
  can_snooze: boolean
  url?: string
}

function parsePayload(event: PushEvent): AlarmPayload | null {
  try {
    const data = event.data?.json() as Partial<AlarmPayload> | undefined
    return data && data.type === 'alarm' ? (data as AlarmPayload) : null
  } catch {
    return null
  }
}

async function windowClients(): Promise<WindowClient[]> {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  return all as WindowClient[]
}

self.addEventListener('push', (event) => {
  const payload = parsePayload(event)
  if (!payload) return
  event.waitUntil(
    (async () => {
      // Janela aberta: ela toca o som e abre a tela de alarme. A notificação vai junto, para
      // o caso de a tela estar apagada.
      for (const client of await windowClients()) client.postMessage(payload)
      await self.registration.showNotification(`${payload.label} · ${payload.time}`, {
        body: 'Toque para abrir e segure 3 segundos para confirmar que levantou.',
        tag: 'alarm',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        requireInteraction: true,
        silent: false,
        data: { url: payload.url ?? ALARM_URL },
        // Campos fora da tipagem do TS mas suportados no Android/Chrome.
        ...({ renotify: true, vibrate: [400, 150, 400, 150, 400] } as NotificationOptions),
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? ALARM_URL
  event.waitUntil(
    (async () => {
      const clients = await windowClients()
      const existing = clients.find((c) => 'focus' in c)
      if (existing) {
        await existing.focus()
        if ('navigate' in existing) await existing.navigate(url)
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})

// Assinatura renovada pelo navegador: a janela aberta reenvia para o servidor.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      for (const client of await windowClients()) client.postMessage({ type: 'pushsubscriptionchange' })
    })(),
  )
})
