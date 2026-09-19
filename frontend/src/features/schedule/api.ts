import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { BlockKind, ScheduleBlock, ScheduleDay, ScheduleWeek, Subject } from '@/lib/types'

export const scheduleKeys = {
  all: ['schedule'] as const,
  week: ['schedule', 'week'] as const,
  day: (date: string) => ['schedule', 'day', date] as const,
  subjects: ['subjects'] as const,
}

export function useScheduleWeek() {
  return useQuery({
    queryKey: scheduleKeys.week,
    queryFn: () => api<ScheduleWeek>('/schedule'),
  })
}

export function useScheduleDay(date: string) {
  return useQuery({
    queryKey: scheduleKeys.day(date),
    queryFn: () => api<ScheduleDay>(`/schedule/day?date=${date}`),
  })
}

export function useSubjects() {
  return useQuery({
    queryKey: scheduleKeys.subjects,
    queryFn: () => api<Subject[]>('/subjects'),
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: scheduleKeys.all })
    void qc.invalidateQueries({ queryKey: scheduleKeys.subjects })
    // Um bloco de treino pode acrescentar dias ao plano (o servidor sincroniza).
    void qc.invalidateQueries({ queryKey: ['workouts'] })
  }
}

export interface BlockBody {
  title: string
  kind: BlockKind
  subject_id?: string | null
  workout_id?: string | null
  weekdays: number[]
  start_time: string
  end_time: string
  location?: string | null
}

export interface BlockPatch {
  title?: string
  kind?: BlockKind
  subject_id?: string | null
  clear_subject?: boolean
  workout_id?: string | null
  clear_workout?: boolean
  weekday?: number
  start_time?: string
  end_time?: string
  location?: string | null
  clear_location?: boolean
  is_active?: boolean
}

export function useCreateBlocks() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: BlockBody) => api<ScheduleBlock[]>('/schedule/blocks', { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateBlock() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, ...body }: BlockPatch & { id: string }) => api<ScheduleBlock>(`/schedule/blocks/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteBlock() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/schedule/blocks/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useCopyDay() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ from, to }: { from: number; to: number[] }) =>
      api<{ created: number; skipped: number }>(`/schedule/days/${from}/copy`, {
        method: 'POST',
        body: { to_weekdays: to },
      }),
    onSuccess: invalidate,
  })
}

export function useCreateSubject() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: { name: string; color: string; teacher?: string | null }) => api<Subject>('/subjects', { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateSubject() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      name?: string
      color?: string
      teacher?: string | null
      clear_teacher?: boolean
      is_active?: boolean
    }) => api<Subject>(`/subjects/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteSubject() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/subjects/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
