import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button, Field } from '@/components/ui'
import { ApiError, errorMessage } from '@/lib/api'
import { isOnboarded, useAuth } from '@/lib/auth-store'

interface Props {
  mode: 'login' | 'register'
}

export function AuthPage({ mode }: Props) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const { login, register } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setLoading(true)
    try {
      const user = isRegister ? await register(name.trim(), email.trim(), password) : await login(email.trim(), password)
      navigate(isOnboarded(user) ? '/hoje' : '/setup', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'validation_error') {
        const fe: Record<string, string> = {}
        for (const f of err.details.fields ?? []) fe[f.field] = f.message
        setFieldErrors(fe)
        setError('Confira os campos destacados.')
      } else {
        setError(errorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="safe-top flex min-h-dvh flex-col pt-6">
      <Link to="/bem-vindo" className="text-[14px] text-ink-muted hover:text-ink">
        ← Voltar
      </Link>

      <div className="mt-10">
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">
          {isRegister ? 'Criar conta' : 'Entrar'}
        </h1>
        <p className="mt-2 text-[15px] text-ink-muted">
          {isRegister ? 'Leva menos de um minuto.' : 'Bom te ver de novo.'}
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {isRegister && (
          <Field
            label="Como quer ser chamado"
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
            required
            autoFocus
          />
        )}
        <Field
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          required
          autoFocus={!isRegister}
        />
        <Field
          label="Senha"
          type={show ? 'text' : 'password'}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={isRegister ? 'Mínimo de 8 caracteres.' : undefined}
          error={fieldErrors.password}
          required
          trailing={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="px-2 text-[13px] font-medium text-ink-muted hover:text-ink"
              aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {show ? 'Ocultar' : 'Mostrar'}
            </button>
          }
        />

        {error && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[14px] text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" full loading={loading} className="mt-2">
          {isRegister ? 'Criar conta' : 'Entrar'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[14px] text-ink-muted">
        {isRegister ? (
          <>
            Já tem conta?{' '}
            <Link to="/entrar" className="font-medium text-ink underline-offset-4 hover:underline">
              Entrar
            </Link>
          </>
        ) : (
          <>
            Ainda não tem conta?{' '}
            <Link to="/criar-conta" className="font-medium text-ink underline-offset-4 hover:underline">
              Criar conta
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
