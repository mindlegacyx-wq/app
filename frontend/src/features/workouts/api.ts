import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type {
  BodyWeightEntry,
  BodyWeightHistory,
  Exercise,
  ExerciseHistory,
  ExerciseLibrary,
  LoadMode,
  SessionDetail,
  Workout,
  WorkoutHistory,
  WorkoutSession,
  WorkoutSet,
  WorkoutsDay,
} from '@/lib/types'

export const setKeys = {
  session: (id: string) => ['workouts', 'session', id] as const,
  library: ['workouts', 'library'] as const,
  body: ['workouts', 'body-weight'] as const,
  exercise: (id: string) => ['workouts', 'exercise-history', id] as const,
}

export const workoutKeys = {
  all: ['workouts'] as const,
  one: (id: string) => ['workouts', id] as const,
  day: (date: string) => ['workouts', 'day', date] as const,
  history: (start: string, end: string) => ['workouts', 'history', start, end] as const,
}

export function useWorkouts() {
  return useQuery({ queryKey: workoutKeys.all, queryFn: () => api<Workout[]>('/workouts') })
}

export function useWorkout(id: string) {
  return useQuery({ queryKey: workoutKeys.one(id), queryFn: () => api<Workout>(`/workouts/${id}`) })
}

export function useWorkoutsDay(date: string) {
  return useQuery({ queryKey: workoutKeys.day(date), queryFn: () => api<WorkoutsDay>(`/workouts/day?date=${date}`) })
}

export function useWorkoutHistory(start: string, end: string) {
  return useQuery({
    queryKey: workoutKeys.history(start, end),
    queryFn: () => api<WorkoutHistory>(`/workouts/history?start=${start}&end=${end}`),
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: workoutKeys.all })
}

export function useCreateWorkout() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: { name: string; days_of_week: number[]; notes?: string | null; goal?: string | null }) =>
      api<Workout>('/workouts', { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateWorkout(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name?: string; days_of_week?: number[]; notes?: string; clear_notes?: boolean; is_active?: boolean; goal?: string | null }) =>
      api<Workout>(`/workouts/${id}`, { method: 'PATCH', body }),
    onSuccess: (w) => {
      qc.setQueryData(workoutKeys.one(id), w)
      void qc.invalidateQueries({ queryKey: workoutKeys.all })
    },
  })
}

export function useDeleteWorkout() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: string) => api<void>(`/workouts/${id}`, { method: 'DELETE' }), onSuccess: invalidate })
}

export interface ExerciseBody {
  name: string
  sets?: number | null
  reps?: string | null
  load?: string | null
  rest_seconds?: number | null
  // Fase 16: vindos da biblioteca ou escolhidos à mão
  library_key?: string | null
  muscle?: string | null
  icon?: string | null
  load_mode?: LoadMode
  bar_weight?: number | null
  increment?: number | null
  goal?: string | null
  start_weight?: number | null
}

export function useAddExercise(workoutId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: ExerciseBody) => api<Exercise>(`/workouts/${workoutId}/exercises`, { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateExercise() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, clear, ...body }: Partial<ExerciseBody> & { id: string; clear?: string[] }) =>
      api<Exercise>(`/workouts/exercises/${id}`, { method: 'PATCH', body: { ...body, clear: clear ?? [] } }),
    onSuccess: invalidate,
  })
}

export function useDeleteExercise() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: string) => api<void>(`/workouts/exercises/${id}`, { method: 'DELETE' }), onSuccess: invalidate })
}

export function useReorderExercises(workoutId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (exercise_ids: string[]) =>
      api<Workout>(`/workouts/${workoutId}/exercises/order`, { method: 'PUT', body: { exercise_ids } }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: workoutKeys.one(workoutId) })
      const previous = qc.getQueryData<Workout>(workoutKeys.one(workoutId))
      if (previous) {
        const byId = new Map(previous.exercises.map((e) => [e.id, e]))
        qc.setQueryData<Workout>(workoutKeys.one(workoutId), {
          ...previous,
          exercises: ids.map((id, k) => ({ ...byId.get(id)!, sort_order: k })),
        })
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(workoutKeys.one(workoutId), ctx.previous)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: workoutKeys.all }),
  })
}

// --- Sessão ------------------------------------------------------------------------------

export function useStartSession(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (workoutId: string) => api<WorkoutSession>(`/workouts/${workoutId}/sessions`, { method: 'POST', body: { date } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: workoutKeys.day(date) }),
  })
}

/** Marca/desmarca um exercício com atualização otimista da visão do dia. */
export function useToggleExercise(date: string) {
  const qc = useQueryClient()
  return useMutation({
    networkMode: 'always', // offline → fila local (ver lib/offline-queue)
    mutationFn: ({ sessionId, exerciseId, completed }: { sessionId: string; exerciseId: string; completed: boolean }) =>
      api<WorkoutSession>(`/workouts/sessions/${sessionId}/exercises/${exerciseId}`, { method: 'PUT', body: { completed }, queue: true }),
    onMutate: async ({ sessionId, exerciseId, completed }) => {
      await qc.cancelQueries({ queryKey: workoutKeys.day(date) })
      const previous = qc.getQueryData<WorkoutsDay>(workoutKeys.day(date))
      if (previous) {
        const workouts = previous.workouts.map((w) => {
          if (w.session?.id !== sessionId) return w
          const exercises = w.exercises.map((e) => (e.id === exerciseId ? { ...e, completed } : e))
          const session = completed && w.session.status !== 'in_progress' ? { ...w.session, status: 'in_progress' as const, completed_at: null } : w.session
          return { ...w, exercises, exercises_done: exercises.filter((e) => e.completed).length, session }
        })
        qc.setQueryData<WorkoutsDay>(workoutKeys.day(date), {
          ...previous,
          workouts,
          completed: workouts.filter((w) => w.session?.status === 'completed').length,
        })
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(workoutKeys.day(date), ctx.previous)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: workoutKeys.all }),
  })
}

export function useSetSessionStatus(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      sessionId,
      ...body
    }: {
      sessionId: string
      status?: WorkoutSession['status']
      notes?: string
      duration_seconds?: number
    }) => api<WorkoutSession>(`/workouts/sessions/${sessionId}`, { method: 'PATCH', body }),
    onSuccess: (_d, { sessionId }) => {
      void qc.invalidateQueries({ queryKey: workoutKeys.all })
      void qc.invalidateQueries({ queryKey: setKeys.session(sessionId) })
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: workoutKeys.day(date) }),
  })
}

// --- Carga por série, biblioteca e peso corporal (Fase 16) --------------------------------

/** Sessão com séries, carga anterior e sugestão. É a tela de execução inteira. */
export function useSessionDetail(sessionId: string | undefined) {
  return useQuery({
    queryKey: setKeys.session(sessionId ?? ''),
    queryFn: () => api<SessionDetail>(`/workouts/sessions/${sessionId}`),
    enabled: !!sessionId,
    staleTime: 10_000,
  })
}

/** Salva peso/reps/feito de uma série, com atualização otimista (o toque não pode esperar). */
export function useUpdateSet(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    networkMode: 'always',
    mutationFn: ({ setId, ...body }: { setId: string; weight?: number; reps?: number; seconds?: number; done?: boolean }) =>
      api<WorkoutSet>(`/workouts/sets/${setId}`, { method: 'PATCH', body, queue: true }),
    onMutate: async ({ setId, ...body }) => {
      const key = setKeys.session(sessionId)
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<SessionDetail>(key)
      if (previous) {
        qc.setQueryData<SessionDetail>(key, {
          ...previous,
          exercises: previous.exercises.map((item) => ({
            ...item,
            sets: item.sets.map((s) => (s.id === setId ? { ...s, ...body } : s)),
          })),
        })
      }
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(setKeys.session(sessionId), ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: setKeys.session(sessionId) })
      void qc.invalidateQueries({ queryKey: workoutKeys.all })
    },
  })
}

export function useAddSet(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { exercise_id: string; weight?: number | null; reps?: number | null }) =>
      api<WorkoutSet>(`/workouts/sessions/${sessionId}/sets`, { method: 'POST', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: setKeys.session(sessionId) }),
  })
}

export function useDeleteSet(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (setId: string) => api<void>(`/workouts/sets/${setId}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: setKeys.session(sessionId) }),
  })
}

export function useExerciseLibrary() {
  return useQuery({
    queryKey: setKeys.library,
    queryFn: () => api<ExerciseLibrary>('/workouts/library'),
    staleTime: 24 * 60 * 60_000, // catálogo fixo: não muda enquanto o app está aberto
  })
}

export function useBodyWeight(days = 180) {
  return useQuery({
    queryKey: [...setKeys.body, days],
    queryFn: () => api<BodyWeightHistory>(`/workouts/body-weight?days=${days}`),
    staleTime: 60_000,
  })
}

export function useSetBodyWeight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { weight: number; date?: string }) =>
      api<BodyWeightEntry>('/workouts/body-weight', { method: 'POST', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: setKeys.body }),
  })
}

export function useExerciseHistory(exerciseId: string | undefined) {
  return useQuery({
    queryKey: setKeys.exercise(exerciseId ?? ''),
    queryFn: () => api<ExerciseHistory>(`/workouts/exercises/${exerciseId}/history`),
    enabled: !!exerciseId,
    staleTime: 60_000,
  })
}
