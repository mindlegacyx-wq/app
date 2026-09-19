import { TopBar } from '@/app/shell/TopBar'
import { EmptyState } from '@/components/ui'

const phaseLabel: Record<number, string> = {
  1: 'Rotinas e checklist diário',
  2: 'Tarefas',
  3: 'Score, sequência e fechamento do dia',
  4: 'Metas e ações',
  5: 'Treinos',
  6: 'Despertador',
  7: 'Estatísticas completas',
}

export function ComingSoonPage({ title, phase }: { title: string; phase: number }) {
  return (
    <>
      <TopBar title={title} />
      <EmptyState
        className="mt-6"
        title="Em construção"
        description={`Esta área chega na Fase ${phase}: ${phaseLabel[phase] ?? ''}.`}
      />
    </>
  )
}
