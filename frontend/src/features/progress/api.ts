import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { DayScore } from '@/lib/types'

export const progressKeys = {
  all: ['progress'] as const,
  day: (date: string) => ['progress', 'day', date] as const,
}

export function useDayScore(date: string) {
  return useQuery({
    queryKey: progressKeys.day(date),
    queryFn: () => api<DayScore>(`/progress/day?date=${date}`),
    staleTime: 5_000,
  })
}

export function useCloseDay(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<DayScore>('/progress/close', { method: 'POST', body: { date } }),
    onSuccess: (data) => qc.setQueryData(progressKeys.day(date), data),
  })
}

export function useReopenDay(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<DayScore>('/progress/reopen', { method: 'POST', body: { date } }),
    onSuccess: (data) => qc.setQueryData(progressKeys.day(date), data),
  })
}
