import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type {
  RecurrenceIn,
  RecurrenceUpdate,
  Task,
  TaskCategory,
  TaskIn,
  TaskRecurrence,
  TasksDay,
  TaskUpdate,
} from '@/lib/types'

export const taskKeys = {
  all: ['tasks'] as const,
  day: (date: string) => ['tasks', 'day', date] as const,
  categories: ['tasks', 'categories'] as const,
  recurrences: ['tasks', 'recurrences'] as const,
}

export function useTasksDay(date: string) {
  return useQuery({ queryKey: taskKeys.day(date), queryFn: () => api<TasksDay>(`/tasks/day?date=${date}`) })
}

export function useCategories() {
  return useQuery({
    queryKey: taskKeys.categories,
    queryFn: () => api<TaskCategory[]>('/tasks/categories'),
    staleTime: 5 * 60_000,
  })
}

function useInvalidateTasks() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: taskKeys.all })
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (body: TaskIn) => api<Task>('/tasks', { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ id, ...body }: TaskUpdate & { id: string }) =>
      api<Task>(`/tasks/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

/** Marca/desmarca com atualização otimista da visão do dia. */
export function useToggleTask(date: string) {
  const qc = useQueryClient()
  return useMutation({
    networkMode: 'always', // offline → fila local (ver lib/offline-queue)
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      api<Task>(`/tasks/${id}`, { method: 'PATCH', body: { status: done ? 'done' : 'pending' }, queue: true }),
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: taskKeys.day(date) })
      const previous = qc.getQueryData<TasksDay>(taskKeys.day(date))
      if (previous) {
        const now = new Date().toISOString()
        const patch = (t: Task): Task =>
          t.id === id ? { ...t, status: done ? 'done' : 'pending', completed_at: done ? now : null } : t
        // Uma atrasada concluída sai de "atrasadas" e entra no dia (o servidor move a data).
        const fromOverdue = previous.overdue.find((t) => t.id === id)
        const tasks = previous.tasks.map(patch)
        if (fromOverdue && done) tasks.push({ ...patch(fromOverdue), date })
        const planned = tasks.filter((t) => t.status !== 'cancelled')
        qc.setQueryData<TasksDay>(taskKeys.day(date), {
          ...previous,
          tasks,
          overdue: previous.overdue.filter((t) => t.id !== id),
          planned: planned.length,
          completed: planned.filter((t) => t.status === 'done').length,
        })
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(taskKeys.day(date), ctx.previous)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; color: string }) =>
      api<TaskCategory>('/tasks/categories', { method: 'POST', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: taskKeys.categories }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; color?: string }) =>
      api<TaskCategory>(`/tasks/categories/${id}`, { method: 'PATCH', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: taskKeys.categories }),
  })
}

export function useDeleteCategory() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/tasks/categories/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}


// --- Tarefas fixas ------------------------------------------------------------------------

export function useRecurrences() {
  return useQuery({
    queryKey: taskKeys.recurrences,
    queryFn: () => api<TaskRecurrence[]>('/tasks/recurrences'),
    staleTime: 60_000,
  })
}

export function useCreateRecurrence() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (body: RecurrenceIn) =>
      api<TaskRecurrence>('/tasks/recurrences', { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateRecurrence() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ id, ...body }: RecurrenceUpdate & { id: string }) =>
      api<TaskRecurrence>(`/tasks/recurrences/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteRecurrence() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/tasks/recurrences/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
