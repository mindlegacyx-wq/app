import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import type { Grade, GradesSummary, User } from '@/lib/types'

export const gradeKeys = {
  all: ['grades'] as const,
  year: (year: number | null) => ['grades', year ?? 'current'] as const,
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
    mutationFn: (body: { passing_grade?: number; periods_per_year?: number; grade_max?: number }) =>
      api<User>('/users/me/settings', { method: 'PATCH', body }),
    onSuccess: (user) => {
      setUser(user)
      invalidate()
    },
  })
}
