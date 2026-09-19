import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button, Card, Dialog, Field, Sheet, Spinner, Toggle } from '@/components/ui'
import { api, errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { cn, dateTime, deviceLabel, shortTime } from '@/lib/format'
import type { Session, User } from '@/lib/types'

const targets = [70, 80, 90] as const

export function SettingsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, setUser, logout } = useAuth()
  const u = user!

  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [revoke, setRevoke] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api<Session[]>('/auth/sessions') })
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<{ version: string }>('/health', { auth: false }),
    staleTime: Infinity,
  })

  const settingsMut = useMutation({
    mutationFn: (body: Partial<User['settings']>) => api<User>('/users/me/settings', { method: 'PATCH', body }),
    onSuccess: setUser,
    onError: (e) => setError(errorMessage(e)),
  })

  const revokeMut = useMutation({
    mutationFn: (id: string) => api<void>(`/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setRevoke(null)
      void qc.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const logoutMut = useMutation({
    mutationFn: logout,
    onSuccess: () => navigate('/bem-vindo', { replace: true }),
  })

  return (
    <div className="safe-top pt-2">
      <header className="flex h-12 items-center gap-3">
        <Link to="/hoje" aria-label="Voltar" className="-ml-2 flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink">
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Configurações</h1>
      </header>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[14px] text-danger">
          {error}
        </p>
      )}

      <Group title="Perfil">
        <Row label="Nome" value={u.name} onClick={() => setProfileOpen(true)} />
        <Row label="E-mail" value={u.email} />
        <Row label="Fuso horário" value={u.timezone} onClick={() => setProfileOpen(true)} />
      </Group>

      <Group title="Disciplina">
        <div className="px-4 py-3.5">
          <p className="text-[15px]">Meta diária</p>
          <div className="mt-2.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Meta de disciplina">
            {targets.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={u.settings.discipline_target === t}
                disabled={settingsMut.isPending}
                onClick={() => settingsMut.mutate({ discipline_target: t })}
                className={cn(
                  'tabular h-10 rounded-sm border text-[15px] font-semibold transition-colors',
                  u.settings.discipline_target === t
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line-strong bg-elevated text-ink-muted hover:text-ink',
                )}
              >
                {t}%
              </button>
            ))}
          </div>
        </div>
        <Row label="Horário de acordar">
          <input
            type="time"
            aria-label="Horário de acordar"
            defaultValue={shortTime(u.settings.wake_time)}
            onBlur={(e) => e.target.value && e.target.value !== shortTime(u.settings.wake_time) && settingsMut.mutate({ wake_time: e.target.value })}
            className="tabular h-9 rounded-sm border border-line-strong bg-elevated px-2 text-[15px]"
          />
        </Row>
      </Group>

      <Group title="Notificações">
        <Row label="Avisos do app" hint="Alarmes e lembretes chegam quando o despertador for ativado.">
          <Toggle
            label="Notificações"
            checked={u.settings.notifications_enabled}
            disabled={settingsMut.isPending}
            onChange={(v) => settingsMut.mutate({ notifications_enabled: v })}
          />
        </Row>
      </Group>

      <Group title="Dispositivos conectados">
        {sessions.isPending ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-5 text-ink-faint" />
          </div>
        ) : sessions.isError ? (
          <p className="px-4 py-4 text-[14px] text-ink-muted">Não foi possível carregar.</p>
        ) : (
          sessions.data.map((s) => (
            <Row
              key={s.id}
              label={deviceLabel(s.user_agent)}
              hint={`${s.is_current ? 'Este dispositivo · ' : ''}${s.last_used_at ? dateTime(s.last_used_at) : dateTime(s.created_at)}`}
            >
              {!s.is_current && (
                <Button size="sm" variant="ghost" onClick={() => setRevoke(s)}>
                  Desconectar
                </Button>
              )}
            </Row>
          ))
        )}
      </Group>

      <Group title="Sobre">
        <Row label="Versão do app" value={__APP_VERSION__} />
        <Row label="Versão da API" value={health.data?.version ?? '…'} />
      </Group>

      <div className="mt-6">
        <Button variant="danger" full onClick={() => setLogoutOpen(true)}>
          Sair da conta
        </Button>
      </div>

      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} user={u} onSaved={setUser} />

      <Dialog
        open={revoke !== null}
        title="Desconectar dispositivo?"
        description={revoke ? `${deviceLabel(revoke.user_agent)} vai precisar entrar de novo.` : undefined}
        confirmLabel="Desconectar"
        danger
        loading={revokeMut.isPending}
        onCancel={() => setRevoke(null)}
        onConfirm={() => revoke && revokeMut.mutate(revoke.id)}
      />

      <Dialog
        open={logoutOpen}
        title="Sair da conta?"
        description="Seus dados continuam salvos. É só entrar de novo."
        confirmLabel="Sair"
        danger
        loading={logoutMut.isPending}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => logoutMut.mutate()}
      />
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-0.5 text-[12px] font-semibold tracking-[0.08em] text-ink-faint uppercase">{title}</h2>
      <Card padded={false} className="divide-y divide-line overflow-hidden">
        {children}
      </Card>
    </section>
  )
}

function Row({
  label,
  value,
  hint,
  onClick,
  children,
}: {
  label: string
  value?: string
  hint?: string
  onClick?: () => void
  children?: ReactNode
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-[15px]">{label}</p>
        {hint && <p className="mt-0.5 truncate text-[13px] text-ink-faint">{hint}</p>}
      </div>
      {value && <p className="max-w-[55%] truncate text-[15px] text-ink-muted">{value}</p>}
      {children}
      {onClick && (
        <svg className="size-4 shrink-0 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      )}
    </>
  )
  const cls = 'flex w-full items-center gap-3 px-4 py-3.5 text-left'
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, 'transition-colors hover:bg-white/4')}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

function ProfileSheet({
  open,
  onClose,
  user,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  user: User
  onSaved: (u: User) => void
}) {
  const [name, setName] = useState(user.name)
  const [timezone, setTimezone] = useState(user.timezone)
  const mut = useMutation({
    mutationFn: () => api<User>('/users/me', { method: 'PATCH', body: { name: name.trim(), timezone } }),
    onSuccess: (u) => {
      onSaved(u)
      onClose()
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    mut.mutate()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Editar perfil">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <Field label="Fuso horário" value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
        {mut.isError && <p className="text-[14px] text-danger">{errorMessage(mut.error)}</p>}
        <Button type="submit" size="lg" full loading={mut.isPending}>
          Salvar
        </Button>
      </form>
    </Sheet>
  )
}
