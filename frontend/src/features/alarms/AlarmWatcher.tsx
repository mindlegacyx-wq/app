import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useRingWake, useWakeDay, wakeKeys } from '@/features/wake/api'
import { isOnboarded, useAuth } from '@/lib/auth-store'
import { todayIn } from '@/lib/format'

import { useAlarms } from './api'
import { unlockAudio } from './sounds'

const ALARM_PATH = '/alarme'

/**
 * Vigia invisível montado em toda tela autenticada. Garante que a tela de alarme abre na hora
 * mesmo sem push, desde que o app esteja aberto (celular na cabeceira):
 *
 * 1. Relógio local: agenda um timer para o próximo alarme e, na hora, pede o disparo ao servidor
 *    (`POST /wake/ring`) — que aplica a mesma regra do job — e navega para /alarme.
 * 2. Estado do dia: se o servidor diz que há alarme tocando (push chegou, app estava fechado),
 *    navega para /alarme ao abrir ou voltar para o app.
 * 3. Mensagem do service worker: o push chegou com o app aberto → navega na hora.
 *
 * Também destrava o áudio no primeiro toque, para a tela de alarme conseguir tocar sozinha.
 */
export function AlarmWatcher() {
  const user = useAuth((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const ring = useRingWake()
  const onAlarmScreen = location.pathname === ALARM_PATH
  const tz = user?.timezone ?? 'America/Sao_Paulo'
  const today = todayIn(tz)

  const ready = isOnboarded(user)
  const alarms = useAlarms({ enabled: ready, refetchInterval: 5 * 60_000 })
  const day = useWakeDay(today, { enabled: ready, refetchInterval: onAlarmScreen ? false : 60_000 })

  // 1) Relógio local para o próximo toque.
  const next = alarms.data?.next ?? null
  const ringRef = useRef(ring)
  useEffect(() => {
    ringRef.current = ring
  })
  useEffect(() => {
    if (!next || onAlarmScreen) return
    const delay = new Date(next.at).getTime() - Date.now()
    if (delay > 24 * 60 * 60_000) return
    const t = window.setTimeout(
      () => {
        ringRef.current.mutate(next.alarm_id, {
          onSuccess: (d) => {
            if (d.ringing) navigate(ALARM_PATH)
          },
          onSettled: () => void qc.invalidateQueries({ queryKey: ['alarms'] }),
        })
      },
      Math.max(0, delay),
    )
    return () => window.clearTimeout(t)
  }, [next, onAlarmScreen, navigate, qc])

  // 2) Servidor diz que está tocando → abre a tela, uma vez por toque. Se a pessoa sair da
  //    tela de propósito, não é puxada de volta; o próximo toque (soneca) abre de novo.
  const d = day.data
  const ringKey = d?.ringing ? `${d.rang_at}:${d.snooze_count}` : null
  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (!ringKey || onAlarmScreen) return
    if (handled.current === ringKey) return
    handled.current = ringKey
    navigate(ALARM_PATH)
  }, [ringKey, onAlarmScreen, navigate])

  // Ao voltar para o app, confere de novo (o push pode ter chegado com a tela apagada).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void qc.invalidateQueries({ queryKey: wakeKeys.all })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [qc])

  // 3) Mensagem do service worker (push com o app aberto).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string } | undefined
      if (data?.type === 'alarm') {
        void qc.invalidateQueries({ queryKey: wakeKeys.all })
        navigate(ALARM_PATH)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate, qc])

  // Destrava o áudio no primeiro gesto.
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  return null
}
