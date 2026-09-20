import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import type { Achievements } from '@/lib/types'

export const achievementKeys = { all: ['achievements'] as const }

export function useAchievements() {
  const authed = useAuth((s) => s.status === 'authed')
  return useQuery({
    queryKey: achievementKeys.all,
    queryFn: () => api<Achievements>('/achievements'),
    enabled: authed,
    staleTime: 30_000,
  })
}

export function useMarkAchievementsSeen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/achievements/seen', { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: achievementKeys.all }),
  })
}
