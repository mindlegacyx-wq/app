import { Link } from 'react-router'

import { TopBar } from '@/app/shell/TopBar'
import { Button, Card, Ring, Section } from '@/components/ui'
import { useAuth } from '@/lib/auth-store'
import { firstName, greeting, longDate, shortTime } from '@/lib/format'

/**
 * Casca da tela Hoje (Fase 0). Os blocos ganham conteúdo real em cada fase:
 * Acordar/Rotinas (1), Tarefas (2), Fechar o dia (3), Metas (4), Treino (5).
 */
export function TodayPage() {
  const user = useAuth((s) => s.user)!
  const target = user.settings.discipline_target
  const wake = shortTime(user.settings.wake_time)

  return (
    <>
      <TopBar hero subtitle={longDate()} title={`${greeting()}, ${firstName(user.name)}`} />

      <Card className="mt-2 flex items-center gap-5 p-5">
        <Ring value={0} size={124} stroke={10} muted>
          <span className="tabular text-[34px] leading-none font-semibold tracking-[-0.03em]">0%</span>
          <span className="mt-1 text-[11px] text-ink-faint">de 0 planejados</span>
        </Ring>
        <dl className="flex flex-1 flex-col gap-3">
          <Stat label="Sequência" value="0" unit="dias" />
          <Stat label="Meta do dia" value={`${target}%`} />
        </dl>
      </Card>

      <div className="mt-7 flex flex-col gap-7">
        <Section title="Acordar" aside={`Alarme às ${wake}`}>
          <Placeholder text="A confirmação de que você levantou entra na próxima etapa." />
        </Section>

        <Section title="Rotina da manhã">
          <Placeholder text="Monte a sua rotina da manhã." to="/rotina" cta="Configurar rotina" />
        </Section>

        <Section title="Tarefas">
          <Placeholder text="Sua lista do dia, por prioridade." />
        </Section>

        <Section title="Treino de hoje">
          <Placeholder text="O treino do dia aparece aqui quando houver um plano." to="/treinos" />
        </Section>

        <Section title="Ações das metas">
          <Placeholder text="Ações com data de hoje aparecem aqui." to="/metas" />
        </Section>

        <Section title="Rotina da noite">
          <Placeholder text="Monte a sua rotina da noite." to="/rotina" cta="Configurar rotina" />
        </Section>
      </div>

      <div className="mt-8">
        <Button size="lg" full variant="secondary" disabled>
          Fechar o dia
        </Button>
        <p className="mt-2 text-center text-[13px] text-ink-faint">Disponível quando houver algo planejado.</p>
      </div>
    </>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <dt className="text-[12px] text-ink-faint">{label}</dt>
      <dd className="tabular text-[22px] leading-tight font-semibold tracking-[-0.02em]">
        {value}
        {unit && <span className="ml-1 text-[13px] font-medium text-ink-muted">{unit}</span>}
      </dd>
    </div>
  )
}

function Placeholder({ text, to, cta }: { text: string; to?: string; cta?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3.5">
      <p className="text-[14px] text-ink-muted">{text}</p>
      {to ? (
        <Link to={to} className="shrink-0 text-[13px] font-semibold text-accent">
          {cta ?? 'Abrir'}
        </Link>
      ) : (
        <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-faint">em breve</span>
      )}
    </div>
  )
}
