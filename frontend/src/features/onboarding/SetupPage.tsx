import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { Button, Field } from '@/components/ui'
import { api, errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, detectTimezone } from '@/lib/format'
import type { User } from '@/lib/types'

const targets = [70, 80, 90] as const

export function SetupPage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuth()

  const [name, setName] = useState(user?.name ?? '')
  const [timezone, setTimezone] = useState(user?.timezone === 'America/Sao_Paulo' ? detectTimezone() : (user?.timezone ?? detectTimezone()))
  const [wakeTime, setWakeTime] = useState('06:00')
  const [target, setTarget] = useState<number>(user?.settings.discipline_target ?? 80)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const updated = await api<User>('/users/me/onboarding', {
        method: 'POST',
        body: { name: name.trim(), timezone, wake_time: wakeTime, discipline_target: target },
      })
      setUser(updated)
      navigate('/instalar', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="safe-top flex min-h-dvh flex-col pt-8">
      <p className="text-[13px] font-semibold tracking-[0.08em] text-accent uppercase">Setup inicial</p>
      <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.03em]">Vamos montar o seu padrão.</h1>
      <p className="mt-2 text-[15px] text-ink-muted">Dá para mudar tudo depois em Configurações.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6" noValidate>
        <Field label="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="given-name" />

        <Field
          label="Horário de acordar"
          type="time"
          value={wakeTime}
          onChange={(e) => setWakeTime(e.target.value)}
          hint="Vira o seu alarme e o início da rotina da manhã."
          required
          className="[&_input]:tabular"
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-muted">Meta de disciplina por dia</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Meta de disciplina">
            {targets.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={target === t}
                onClick={() => setTarget(t)}
                className={cn(
                  'tabular h-12 rounded-md border text-[16px] font-semibold transition-colors',
                  target === t
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line-strong bg-elevated text-ink-muted hover:text-ink',
                )}
              >
                {t}%
              </button>
            ))}
          </div>
          <p className="text-[13px] text-ink-faint">
            Um dia conta na sequência quando você cumpre pelo menos essa fração do que planejou.
          </p>
        </div>

        <Field
          label="Fuso horário"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          hint="Detectado automaticamente. É o que mantém alarmes e sequência certos."
          list="tz-list"
        />
        <datalist id="tz-list">
          {['America/Sao_Paulo', 'America/Manaus', 'America/Fortaleza', 'America/Cuiaba', 'Europe/Lisbon', 'Europe/Madrid'].map(
            (tz) => (
              <option key={tz} value={tz} />
            ),
          )}
        </datalist>

        {error && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[14px] text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" full loading={loading}>
          Continuar
        </Button>
      </form>
    </div>
  )
}
