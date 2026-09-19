import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Goal, GoalAction, GoalIn, GoalsDay, GoalStatus, GoalUpdate } from '@/lib/types'

export const goalKeys = {
  all: ['goals'] as const,
  list: (status: GoalStatus | 'all') => ['goals', 'list', status] as const,
  one: (id: string) => ['goals', id] as const,
  day: (date: string) => ['goals', 'day', date] as const,
}

export function useGoals(status: GoalStatus | 'all') {
  return useQuery({
    queryKey: goalKeys.list(status),
    queryFn: () => api<Goal[]>(status === 'all' ? '/goals' : `/goals?status=${status}`),
  })
}

export function useGoal(id: string) {
  return useQuery({ queryKey: goalKeys.one(id), queryFn: () => api<Goal>(`/goals/${id}`) })
}

export function useGoalsDay(date: string) {
  return useQuery({ queryKey: goalKeys.day(date), queryFn: () => api<GoalsDay>(`/goals/day?date=${date}`) })
}

function useInvalidateGoals() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: goalKeys.all })
}

export function useCreateGoal() {
  const invalidate = useInvalidateGoals()
  return useMutation({ mutationFn: (body: GoalIn) => api<Goal>('/goals', { method: 'POST', body }), onSuccess: invalidate })
}

export function useUpdateGoal(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: GoalUpdate) => api<Goal>(`/goals/${id}`, { method: 'PATCH', body }),
    onSuccess: (goal) => {
      qc.setQueryData(goalKeys.one(id), goal)
      void qc.invalidateQueries({ queryKey: goalKeys.all })
    },
  })
}

export function useDeleteGoal() {
  const invalidate = useInvalidateGoals()
  return useMutation({ mutationFn: (id: string) => api<void>(`/goals/${id}`, { method: 'DELETE' }), onSuccess: invalidate })
}

export function useAddAction(goalId: string) {
  const invalidate = useInvalidateGoals()
  return useMutation({
    mutationFn: (body: { title: string; due_date?: string | null }) =>
      api<GoalAction>(`/goals/${goalId}/actions`, { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateAction() {
  const invalidate = useInvalidateGoals()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string; due_date?: string | null; clear_due_date?: boolean; is_done?: boolean }) =>
      api<GoalAction>(`/goals/actions/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteAction() {
  const invalidate = useInvalidateGoals()
  return useMutation({ mutationFn: (id: string) => api<void>(`/goals/actions/${id}`, { method: 'DELETE' }), onSuccess: invalidate })
}

export function useReorderActions(goalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (action_ids: string[]) =>
      api<Goal>(`/goals/${goalId}/actions/order`, { method: 'PUT', body: { action_ids } }),
    onMutate: async (action_ids) => {
      await qc.cancelQueries({ queryKey: goalKeys.one(goalId) })
      const previous = qc.getQueryData<Goal>(goalKeys.one(goalId))
      if (previous) {
        const byId = new Map(previous.actions.map((a) => [a.id, a]))
        qc.setQueryData<Goal>(goalKeys.one(goalId), {
          ...previous,
          actions: action_ids.map((id, k) => ({ ...byId.get(id)!, sort_order: k })),
        })
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(goalKeys.one(goalId), ctx.previous)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: goalKeys.all }),
  })
}

/** Marca/desmarca uma ação a partir do detalhe da meta ou do bloco em Hoje (otimista nos dois). */
export function useToggleAction(opts: { goalId?: string; date?: string }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      api<GoalAction>(`/goals/actions/${id}`, { method: 'PATCH', body: { is_done: done } }),
    onMutate: async ({ id, done }) => {
      const now = new Date().toISOString()
      const snapshots: { key: readonly unknown[]; data: unknown }[] = []
      if (opts.goalId) {
        const key = goalKeys.one(opts.goalId)
        await qc.cancelQueries({ queryKey: key })
        const prev = qc.getQueryData<Goal>(key)
        if (prev) {
          snapshots.push({ key, data: prev })
          const actions = prev.actions.map((a) => (a.id === id ? { ...a, is_done: done, done_at: done ? now : null } : a))
          const doneCount = actions.filter((a) => a.is_done).length
          qc.setQueryData<Goal>(key, {
            ...prev,
            actions,
            actions_done: doneCount,
            progress_pct: actions.length ? Math.round((doneCount / actions.length) * 100) : 0,
          })
        }
      }
      if (opts.date) {
        const key = goalKeys.day(opts.date)
        await qc.cancelQueries({ queryKey: key })
        const prev = qc.getQueryData<GoalsDay>(key)
        if (prev) {
          snapshots.push({ key, data: prev })
          const patch = (a: GoalsDay['actions'][number]) => (a.id === id ? { ...a, is_done: done, done_at: done ? now : null } : a)
          const fromOverdue = prev.overdue.find((a) => a.id === id)
          const actions = prev.actions.map(patch)
          if (fromOverdue && done) actions.push({ ...patch(fromOverdue), due_date: opts.date })
          qc.setQueryData<GoalsDay>(key, {
            ...prev,
            actions,
            overdue: prev.overdue.filter((a) => a.id !== id),
            planned: actions.length,
            completed: actions.filter((a) => a.is_done).length,
          })
        }
      }
      return { snapshots }
    },
    onError: (_e, _v, ctx) => {
      for (const s of ctx?.snapshots ?? []) qc.setQueryData(s.key, s.data)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: goalKeys.all }),
  })
}
