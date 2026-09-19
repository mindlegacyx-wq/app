import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Exam, ExamDetail, ExamKind, ExamStatus, ExamTopic, StudyDay, StudySession, StudySessionStatus } from '@/lib/types'

export const studyKeys = {
  exams: ['exams'] as const,
  examList: (includePast: boolean) => ['exams', 'list', includePast] as const,
  exam: (id: string) => ['exams', id] as const,
  study: ['study'] as const,
  day: (date: string) => ['study', 'day', date] as const,
  session: (examId: string, date: string) => ['study', 'session', examId, date] as const,
}

export function useExams(includePast = false) {
  return useQuery({
    queryKey: studyKeys.examList(includePast),
    queryFn: () => api<Exam[]>(`/exams${includePast ? '?include_past=true' : ''}`),
  })
}

export function useExam(id: string) {
  return useQuery({ queryKey: studyKeys.exam(id), queryFn: () => api<ExamDetail>(`/exams/${id}`) })
}

export function useStudyDay(date: string) {
  return useQuery({ queryKey: studyKeys.day(date), queryFn: () => api<StudyDay>(`/study/day?date=${date}`) })
}

export function useStudySession(examId: string, date: string) {
  return useQuery({
    queryKey: studyKeys.session(examId, date),
    queryFn: () => api<StudySession>(`/study/sessions/${examId}/${date}`),
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: studyKeys.exams })
    void qc.invalidateQueries({ queryKey: studyKeys.study })
  }
}

export interface ExamBody {
  title: string
  kind: ExamKind
  subject_id?: string | null
  date: string
  lead_days: number
  minutes_per_day: number
  notes?: string | null
  topics?: string[]
}

export interface ExamPatch {
  title?: string
  kind?: ExamKind
  subject_id?: string | null
  clear_subject?: boolean
  date?: string
  lead_days?: number
  minutes_per_day?: number
  notes?: string | null
  clear_notes?: boolean
  status?: ExamStatus
}

export function useCreateExam() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (body: ExamBody) => api<ExamDetail>('/exams', { method: 'POST', body }), onSuccess: invalidate })
}

export function useUpdateExam() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, ...body }: ExamPatch & { id: string }) => api<ExamDetail>(`/exams/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteExam() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: string) => api<void>(`/exams/${id}`, { method: 'DELETE' }), onSuccess: invalidate })
}

export function useAddTopic() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ examId, title }: { examId: string; title: string }) =>
      api<ExamTopic>(`/exams/${examId}/topics`, { method: 'POST', body: { title } }),
    onSuccess: invalidate,
  })
}

export function useUpdateTopic() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ examId, id, ...body }: { examId: string; id: string; title?: string; is_done?: boolean }) =>
      api<ExamTopic>(`/exams/${examId}/topics/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteTopic() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ examId, id }: { examId: string; id: string }) => api<void>(`/exams/${examId}/topics/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useStartSession() {
  const qc = useQueryClient()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ examId, date }: { examId: string; date: string }) =>
      api<StudySession>('/study/sessions', { method: 'POST', body: { exam_id: examId, date } }),
    onSuccess: (s) => {
      qc.setQueryData(studyKeys.session(s.exam_id, s.date), s)
      invalidate()
    },
  })
}

export function useUpdateSession() {
  const qc = useQueryClient()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: StudySessionStatus; focused_seconds?: number }) =>
      api<StudySession>(`/study/sessions/${id}`, { method: 'PATCH', body }),
    onSuccess: (s) => {
      qc.setQueryData(studyKeys.session(s.exam_id, s.date), s)
      invalidate()
    },
  })
}
