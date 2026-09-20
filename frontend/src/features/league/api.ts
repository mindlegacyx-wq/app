import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import type { League } from '@/lib/types'

export const leagueKeys = { all: ['league'] as const }

/** Classificação da semana. Atualiza sozinha a cada minuto: os robôs jogam o dia inteiro. */
export function useLeague() {
  const authed = useAuth((s) => s.status === 'authed')
  return useQuery({
    queryKey: leagueKeys.all,
    queryFn: () => api<League>('/league'),
    enabled: authed,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })
}

export function useMarkResultSeen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/league/seen', { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: leagueKeys.all }),
  })
}
