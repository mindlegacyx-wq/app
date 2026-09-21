import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import type { GradeArea, GradeEntryMode, Grade, GradesSummary, Subject, User } from '@/lib/types'

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

/** Em qual área a matéria entra e como ela lança nota (final do trimestre ou por avaliações). */
export function useSetSubjectGradeSettings() {
  const invalidate = useInvalidate()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      area_id?: string | null
      clear_area?: boolean
      entry_mode?: GradeEntryMode
    }) => api<Subject>(`/grades/subjects/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      invalidate()
      void qc.invalidateQueries({ queryKey: ['subjects'] })
    },
  })
}
