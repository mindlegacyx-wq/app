import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import type { Player } from '@/lib/types'

export const playerKeys = { all: ['player'] as const }

/** Nível e XP. Invalidado por qualquer mutação (ver main.tsx). */
export function usePlayer() {
  const authed = useAuth((s) => s.status === 'authed')
  return useQuery({
    queryKey: playerKeys.all,
    queryFn: () => api<Player>('/player'),
    enabled: authed,
    staleTime: 15_000,
  })
}
