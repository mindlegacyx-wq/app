import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { WakeDay, WakeHistory } from '@/lib/types'

export const wakeKeys = {
  all: ['wake'] as const,
  day: (date: string) => ['wake', 'day', date] as const,
  history: (start: string, end: string) => ['wake', 'history', start, end] as const,
}

export function useWakeDay(date: string, opts?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: wakeKeys.day(date),
    queryFn: () => api<WakeDay>(`/wake/day?date=${date}`),
    enabled: opts?.enabled ?? true,
    refetchInterval: opts?.refetchInterval ?? false,
  })
}

export function useWakeHistory(start: string, end: string) {
  return useQuery({
    queryKey: wakeKeys.history(start, end),
    queryFn: () => api<WakeHistory>(`/wake/history?start=${start}&end=${end}`),
  })
}

function useSetDay() {
  const qc = useQueryClient()
  return (data: WakeDay) => {
    qc.setQueryData(wakeKeys.day(data.date), data)
    void qc.invalidateQueries({ queryKey: ['wake', 'history'] })
  }
}

export function useConfirmWake(date: string) {
  const setDay = useSetDay()
  return useMutation({
    mutationFn: () => api<WakeDay>('/wake/confirm', { method: 'POST', body: { date } }),
    onSuccess: setDay,
  })
}

export function useUndoWake(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>(`/wake/day?date=${date}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: wakeKeys.all }),
  })
}

/** Disparo pedido pelo app aberto na hora do alarme (o servidor aplica a mesma regra do job). */
export function useRingWake() {
  const setDay = useSetDay()
  return useMutation({
    mutationFn: (alarmId: string) => api<WakeDay>('/wake/ring', { method: 'POST', body: { alarm_id: alarmId } }),
    onSuccess: setDay,
  })
}

export function useSnoozeWake() {
  const setDay = useSetDay()
  return useMutation({
    mutationFn: () => api<WakeDay>('/wake/snooze', { method: 'POST' }),
    onSuccess: setDay,
  })
}
