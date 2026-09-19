import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { WakeDay } from '@/lib/types'

export const wakeKeys = { day: (date: string) => ['wake', date] as const }

export function useWakeDay(date: string) {
  return useQuery({ queryKey: wakeKeys.day(date), queryFn: () => api<WakeDay>(`/wake/day?date=${date}`) })
}

export function useConfirmWake(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<WakeDay>('/wake/confirm', { method: 'POST', body: { date } }),
    onSuccess: (data) => qc.setQueryData(wakeKeys.day(date), data),
  })
}

export function useUndoWake(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>(`/wake/day?date=${date}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: wakeKeys.day(date) }),
  })
}
