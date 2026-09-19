import type { ArtifactKind, StudyMaterial } from '@/lib/types'

export const artifactLabel: Record<ArtifactKind, string> = {
  theory: 'Teoria',
  solutions: 'Resoluções',
  mindmap: 'Mapa mental',
  quiz: 'Quiz',
}

export const artifactHint: Record<ArtifactKind, string> = {
  theory: 'Só o que cai nesses exercícios.',
  solutions: 'Passo a passo, um por um.',
  mindmap: 'Os conceitos ligados entre si.',
  quiz: 'Questões novas para treinar.',
}

export const ARTIFACT_KINDS: ArtifactKind[] = ['theory', 'solutions', 'mindmap', 'quiz']

export function materialTitle(m: StudyMaterial, index: number): string {
  return m.title ?? (m.source === 'photo' ? `Fotos ${index + 1}` : `Texto ${index + 1}`)
}
