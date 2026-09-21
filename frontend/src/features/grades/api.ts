import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import type { GradeArea, GradeEntryMode, Grade, GradesSummary, Subject, User } from '@/lib/types'

import { isSummary, withAreaOrder, withEntryMode, withSubjectArea, withSubjectsInArea } from './board-cache'

export const gradeKeys = {
  all: ['grades'] as const,
  year: (year: number | null) => ['grades', year ?? 'current'] as const,
  areas: ['grades', 'areas'] as const,
}

export function useGrades(year: number | null = null) {
  return useQuery({
    queryKey: gradeKeys.year(year),
    queryFn: () => api<GradesSummary>(`/grades${year ? `?year=${year}` : ''}`),
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: gradeKeys.all })
}

export interface GradeBody {
  subject_id: string
  year: number
  period: number
  title?: string | null
  value: number
  weight?: number
  max_points?: number | null
  exam_id?: string | null
}

export function useCreateGrade() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (body: GradeBody) => api<Grade>('/grades', { method: 'POST', body }), onSuccess: invalidate })
}

export function useUpdateGrade() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      period?: number
      title?: string | null
      clear_title?: boolean
      value?: number
      weight?: number
      max_points?: number | null
      clear_max_points?: boolean
    }) => api<Grade>(`/grades/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteGrade() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: string) => api<void>(`/grades/${id}`, { method: 'DELETE' }), onSuccess: invalidate })
}

/** Régua de notas (média mínima, períodos, nota máxima) vive nas configurações do usuário. */
export function useUpdateGradeSettings() {
  const setUser = useAuth((s) => s.setUser)
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: {
      passing_grade?: number
      periods_per_year?: number
      grade_max?: number
      grade_mode?: 'weighted' | 'sum'
      grades_by_area?: boolean
    }) =>
      api<User>('/users/me/settings', { method: 'PATCH', body }),
    onSuccess: (user) => {
      setUser(user)
      invalidate()
    },
  })
}


// --- Áreas de conhecimento -----------------------------------------------------------------

export function useGradeAreas() {
  return useQuery({
    queryKey: gradeKeys.areas,
    queryFn: () => api<GradeArea[]>('/grades/areas'),
    staleTime: 60_000,
  })
}

export function useCreateArea() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: { name: string; color?: string }) =>
      api<GradeArea>('/grades/areas', { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateArea() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; color?: string }) =>
      api<GradeArea>(`/grades/areas/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteArea() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/grades/areas/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

// --- Quadro de áreas: a tela muda no toque, o servidor confirma depois ----------------------

const BOARD = ['grades-board'] as const

/**
 * Mutação do quadro com resposta imediata.
 *
 * Antes, mover uma matéria esperava o servidor responder e o resumo inteiro recarregar — no
 * plano grátis isso dava segundos de espera. Agora: escreve no cache na hora, e se o servidor
 * recusar, volta como estava. O recarregamento de verdade só acontece quando a última mutação
 * da fila termina, para uma resposta antiga não desfazer um toque mais novo.
 */
function useBoardMutation<V>(
  mutationFn: (vars: V) => Promise<unknown>,
  optimistic: (s: GradesSummary, vars: V) => GradesSummary,
  alsoInvalidate: readonly (readonly unknown[])[] = [],
) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: BOARD,
    mutationFn,
    onMutate: async (vars: V) => {
      await qc.cancelQueries({ queryKey: gradeKeys.all })
      const before = qc.getQueriesData({ queryKey: gradeKeys.all })
      qc.setQueriesData({ queryKey: gradeKeys.all }, (d: unknown) => (isSummary(d) ? optimistic(d, vars) : d))
      return { before }
    },
    onError: (_e, _v, ctx) => {
      ctx?.before.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: BOARD }) <= 1) {
        void qc.invalidateQueries({ queryKey: gradeKeys.all })
        alsoInvalidate.forEach((k) => void qc.invalidateQueries({ queryKey: k }))
      }
    },
  })
}

/** A área passa a ter exatamente estas matérias, nesta ordem: adicionar várias, tirar, reordenar. */
export function useSetAreaSubjects() {
  return useBoardMutation(
    ({ areaId, subjectIds }: { areaId: string; subjectIds: string[] }) =>
      api(`/grades/areas/${areaId}/subjects`, { method: 'PUT', body: { subject_ids: subjectIds } }),
    (s, v) => withSubjectsInArea(s, v.areaId, v.subjectIds),
    [['subjects']],
  )
}

export function useReorderAreas() {
  return useBoardMutation(
    (areaIds: string[]) => api('/grades/areas/order', { method: 'PUT', body: { area_ids: areaIds } }),
    (s, ids) => withAreaOrder(s, ids),
    [['subjects']],
  )
}

/** Em qual área a matéria entra e como ela lança nota (final do trimestre ou por avaliações). */
export function useSetSubjectGradeSettings() {
  return useBoardMutation(
    ({
      id,
      ...body
    }: {
      id: string
      area_id?: string | null
      clear_area?: boolean
      entry_mode?: GradeEntryMode
    }) => api<Subject>(`/grades/subjects/${id}`, { method: 'PATCH', body }),
    (s, v) => {
      let out = s
      if (v.clear_area) out = withSubjectArea(out, v.id, null)
      else if (v.area_id) out = withSubjectArea(out, v.id, v.area_id)
      if (v.entry_mode) out = withEntryMode(out, v.id, v.entry_mode)
      return out
    },
    [['subjects']],
  )
}
