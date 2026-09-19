import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, apiUpload } from '@/lib/api'
import type { AIStatus, ArtifactKind, ExamAI, MaterialSource, StudyMaterial } from '@/lib/types'

export const aiKeys = {
  status: ['ai', 'status'] as const,
  exam: (examId: string) => ['ai', 'exam', examId] as const,
}

export function useAIStatus() {
  return useQuery({ queryKey: aiKeys.status, queryFn: () => api<AIStatus>('/ai/status'), staleTime: 5 * 60_000 })
}

/** Estado da IA de uma prova. Enquanto algo está sendo gerado, consulta a cada 3 s. */
export function useExamAI(examId: string) {
  return useQuery({
    queryKey: aiKeys.exam(examId),
    queryFn: () => api<ExamAI>(`/exams/${examId}/ai`),
    refetchInterval: (q) => {
      const busy = q.state.data?.artifacts.some((a) => a.status === 'running' || (a.status === 'queued' && a.updated_at !== null))
      return busy ? 3000 : false
    },
  })
}

function useInvalidate(examId: string) {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: aiKeys.exam(examId) })
}

export function useTranscribe(examId: string) {
  return useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData()
      for (const f of files) form.append('files', f, f.name || 'foto.jpg')
      return apiUpload<{ content: string; images: number }>(`/exams/${examId}/materials/transcribe`, form)
    },
  })
}

export function useAddMaterial(examId: string) {
  const invalidate = useInvalidate(examId)
  return useMutation({
    mutationFn: (body: { title?: string | null; source: MaterialSource; content: string }) =>
      api<StudyMaterial>(`/exams/${examId}/materials`, { method: 'POST', body }),
    onSuccess: invalidate,
  })
}

export function useUpdateMaterial(examId: string) {
  const invalidate = useInvalidate(examId)
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string | null; clear_title?: boolean; content?: string }) =>
      api<StudyMaterial>(`/exams/${examId}/materials/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  })
}

export function useDeleteMaterial(examId: string) {
  const invalidate = useInvalidate(examId)
  return useMutation({
    mutationFn: (id: string) => api<void>(`/exams/${examId}/materials/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useGenerate(examId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (kinds?: ArtifactKind[]) => api<ExamAI>(`/exams/${examId}/ai/generate`, { method: 'POST', body: kinds ? { kinds } : {} }),
    onSuccess: (data) => qc.setQueryData(aiKeys.exam(examId), data),
  })
}
