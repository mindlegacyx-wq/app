import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { wakeKeys } from '@/features/wake/api'
import { api, apiUpload } from '@/lib/api'
import type { Alarm, AlarmSound, AlarmSoundFile, AlarmsOverview, PushStatus } from '@/lib/types'

export const alarmKeys = {
  all: ['alarms'] as const,
  one: (id: string) => ['alarms', id] as const,
}

export const soundKeys = { all: ['alarms', 'sounds'] as const }

export const pushKeys = { status: ['push', 'status'] as const }

export function usePushStatus() {
  return useQuery({ queryKey: pushKeys.status, queryFn: () => api<PushStatus>('/users/me/push'), staleTime: 60_000 })
}

export interface AlarmBody {
  label?: string
  time?: string // "HH:MM"
  days_of_week?: number[]
  sound?: AlarmSound
  sound_file_id?: string | null
  clear_sound_file?: boolean
  insist?: boolean
  requires_confirmation?: boolean
  max_snoozes?: number
  snooze_minutes?: number
  is_active?: boolean
}

export function useAlarms(opts?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: alarmKeys.all,
    queryFn: () => api<AlarmsOverview>('/alarms'),
    enabled: opts?.enabled ?? true,
    refetchInterval: opts?.refetchInterval ?? false,
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: alarmKeys.all })
    // O alarme do dia define o horário planejado de acordar em Hoje.
    void qc.invalidateQueries({ queryKey: wakeKeys.all })
  }
}

export function useCreateAlarm() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: AlarmBody & { time: string }) => api<Alarm>('/alarms', { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateAlarm() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, ...body }: AlarmBody & { id: string }) => api<Alarm>(`/alarms/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteAlarm() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/alarms/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}


// --- Áudio do usuário ---------------------------------------------------------------------

export function useAlarmSounds() {
  return useQuery({
    queryKey: soundKeys.all,
    queryFn: () => api<AlarmSoundFile[]>('/alarms/sounds'),
    staleTime: 60_000,
  })
}

export function useUploadAlarmSound() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      form.append('name', file.name.replace(/\.[^.]+$/, '').slice(0, 60))
      return apiUpload<AlarmSoundFile>('/alarms/sounds', form)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: soundKeys.all }),
  })
}

export function useDeleteAlarmSound() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/alarms/sounds/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: soundKeys.all })
      void qc.invalidateQueries({ queryKey: alarmKeys.all })
    },
  })
}
