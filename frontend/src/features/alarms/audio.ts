import { apiBlob } from '@/lib/api'

/**
 * Áudio do alarme escolhido pelo usuário.
 *
 * O arquivo fica guardado no Cache Storage na primeira vez que toca: o despertador não pode
 * depender de internet às 6 da manhã. O endereço nunca muda para o mesmo id (trocar o som
 * gera outro id), então cache eterno é seguro.
 */
const CACHE = 'alarm-sounds-v1'

function pathOf(id: string): string {
  return `/api/v1/alarms/sounds/${id}/file`
}

async function fromCache(id: string): Promise<Blob | null> {
  try {
    const cache = await caches.open(CACHE)
    const hit = await cache.match(pathOf(id))
    return hit ? await hit.blob() : null
  } catch {
    return null // navegador sem Cache Storage: segue pela rede
  }
}

async function keep(id: string, blob: Blob): Promise<void> {
  try {
    const cache = await caches.open(CACHE)
    await cache.put(pathOf(id), new Response(blob, { headers: { 'Content-Type': blob.type } }))
  } catch {
    /* sem cache: tudo bem, só não toca offline */
  }
}

/** Devolve um endereço tocável (blob:) para o áudio, de preferência sem rede. */
export async function alarmSoundUrl(id: string): Promise<string> {
  const cached = await fromCache(id)
  if (cached) return URL.createObjectURL(cached)
  const blob = await apiBlob(`/alarms/sounds/${id}/file`)
  await keep(id, blob.slice(0, blob.size, blob.type))
  return URL.createObjectURL(blob)
}

/** Guarda o áudio antes da hora — chamado ao escolher o som. */
export async function prefetchAlarmSound(id: string): Promise<void> {
  if (await fromCache(id)) return
  try {
    await keep(id, await apiBlob(`/alarms/sounds/${id}/file`))
  } catch {
    /* sem rede agora: tenta de novo quando tocar */
  }
}

export async function forgetAlarmSound(id: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE)
    await cache.delete(pathOf(id))
  } catch {
    /* nada a limpar */
  }
}

export interface AudioPlayer {
  stop: () => void
}

/**
 * Toca o arquivo em loop, no volume cheio. Se o navegador bloquear (sem gesto do usuário),
 * chama `onBlocked` para a tela cair no som sintetizado — alarme mudo não existe.
 */
export function playLoop(url: string, onBlocked: () => void): AudioPlayer {
  const el = new Audio(url)
  el.loop = true
  el.volume = 1
  el.preload = 'auto'
  void el.play().catch(onBlocked)
  return {
    stop: () => {
      el.pause()
      el.src = ''
      URL.revokeObjectURL(url)
    },
  }
}
