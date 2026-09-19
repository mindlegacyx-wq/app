/** Hooks de dados do módulo de rotinas (TanStack Query). */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Routine, RoutineIn, RoutineItem, RoutinesDay } from '@/lib/types'

export const routineKeys = {
  all: ['routines'] as const,
  one: (id: string) => ['routines', id] as const,
  day: (date: string) => ['routines', 'day', date] as const,
}

export function useRoutines() {
  return useQuery({ queryKey: routineKeys.all, queryFn: () => api<Routine[]>('/routines') })
}

export function useRoutine(id: string) {
  return useQuery({ queryKey: routineKeys.one(id), queryFn: () => api<Routine>(`/routines/${id}`) })
}

export function useRoutinesDay(date: string) {
  return useQuery({
    queryKey: routineKeys.day(date),
    queryFn: () => api<RoutinesDay>(`/routines/day?date=${date}`),
  })
}

function useInvalidateRoutines() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: routineKeys.all })
}

export function useCreateRoutine() {
  const invalidate = useInvalidateRoutines()
  return useMutation({
    mutationFn: (body: RoutineIn) => api<Routine>('/routines', { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateRoutine(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<RoutineIn> & { is_active?: boolean }) =>
      api<Routine>(`/routines/${id}`, { method: 'PATCH', body }),
    onSuccess: (routine) => {
      qc.setQueryData(routineKeys.one(id), routine)
      void qc.invalidateQueries({ queryKey: routineKeys.all })
    },
  })
}

export function useDeleteRoutine() {
  const invalidate = useInvalidateRoutines()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/routines/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useAddItem(routineId: string) {
  const invalidate = useInvalidateRoutines()
  return useMutation({
    mutationFn: (body: { title: string; duration_minutes?: number | null }) =>
      api<RoutineItem>(`/routines/${routineId}/items`, { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateItem() {
  const invalidate = useInvalidateRoutines()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string; duration_minutes?: number | null; is_active?: boolean }) =>
      api<RoutineItem>(`/routines/items/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteItem() {
  const invalidate = useInvalidateRoutines()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/routines/items/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useReorderItems(routineId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (item_ids: string[]) =>
      api<Routine>(`/routines/${routineId}/items/order`, { method: 'PUT', body: { item_ids } }),
    // Otimista: reordena localmente na hora; o servidor confirma em seguida.
    onMutate: async (item_ids) => {
      await qc.cancelQueries({ queryKey: routineKeys.one(routineId) })
      const previous = qc.getQueryData<Routine>(routineKeys.one(routineId))
      if (previous) {
        const byId = new Map(previous.items.map((i) => [i.id, i]))
        qc.setQueryData<Routine>(routineKeys.one(routineId), {
          ...previous,
          items: item_ids.map((id, k) => ({ ...byId.get(id)!, sort_order: k })),
        })
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(routineKeys.one(routineId), ctx.previous)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: routineKeys.all }),
  })
}

/** Marca/desmarca um item do checklist com atualização otimista da visão do dia. */
export function useCheckItem(date: string) {
  const qc = useQueryClient()
  return useMutation({
    // Sem rede o TanStack pausaria a mutação; aqui ela roda e cai na fila local persistida.
    networkMode: 'always',
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
      api<void>(`/routines/items/${itemId}/check`, { method: 'PUT', body: { date, done }, queue: true }),
    onMutate: async ({ itemId, done }) => {
      await qc.cancelQueries({ queryKey: routineKeys.day(date) })
      const previous = qc.getQueryData<RoutinesDay>(routineKeys.day(date))
      if (previous) {
        const now = new Date().toISOString()
        const routines = previous.routines.map((r) => {
          const items = r.items.map((i) =>
            i.id === itemId ? { ...i, completed_at: done ? now : null } : i,
          )
          return { ...r, items, completed: items.filter((i) => i.completed_at).length }
        })
        qc.setQueryData<RoutinesDay>(routineKeys.day(date), {
          ...previous,
          routines,
          completed: routines.reduce((n, r) => n + r.completed, 0),
        })
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(routineKeys.day(date), ctx.previous)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: routineKeys.day(date) }),
  })
}
