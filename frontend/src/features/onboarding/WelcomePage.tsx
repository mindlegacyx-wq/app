import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button, Ring } from '@/components/ui'
import { cn } from '@/lib/format'

const slides = [
  {
    title: 'Seu dia, montado.',
    text: 'Rotina da manhã, tarefas, treino, ações das metas e rotina da noite. Tudo em uma tela, na ordem do dia.',
    visual: <RoutineVisual />,
  },
  {
    title: 'Prova de que você levantou.',
    text: 'O alarme só desliga quando você segura o botão por 3 segundos. O horário real fica registrado.',
    visual: <WakeVisual />,
  },
  {
    title: 'Um número honesto, todo dia.',
    text: 'Ao fechar o dia, você vê quanto cumpriu do que planejou e há quantos dias mantém a sequência.',
    visual: (
      <Ring value={87} size={150} stroke={11}>
        <span className="tabular text-[40px] leading-none font-semibold tracking-[-0.03em]">87%</span>
        <span className="mt-1 text-[12px] text-ink-muted">12 dias seguidos</span>
      </Ring>
    ),
  },
]

export function WelcomePage() {
  const [i, setI] = useState(0)
  const navigate = useNavigate()
  const last = i === slides.length - 1
  const slide = slides[i]!

  return (
    <div className="safe-top flex min-h-dvh flex-col pt-6">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Disciplina</span>
        <Link to="/entrar" className="text-[14px] font-medium text-ink-muted hover:text-ink">
          Já tenho conta
        </Link>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <div className="flex h-56 items-center justify-center">
          <AnimatePresence mode="wait">
            <m.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            >
              {slide.visual}
            </m.div>
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          <m.div
            key={i}
            className="mt-8 min-h-36"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, delay: 0.05 }}
          >
            <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">{slide.title}</h1>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-muted">{slide.text}</p>
          </m.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-between pb-6">
        <div className="flex gap-1.5" aria-label={`Passo ${i + 1} de ${slides.length}`}>
          {slides.map((_, k) => (
            <button
              key={k}
              aria-label={`Ir para o passo ${k + 1}`}
              onClick={() => setI(k)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                k === i ? 'w-6 bg-accent' : 'w-1.5 bg-white/20',
              )}
            />
          ))}
        </div>
        <Button size="lg" onClick={() => (last ? navigate('/criar-conta') : setI(i + 1))}>
          {last ? 'Começar' : 'Próximo'}
        </Button>
      </div>
    </div>
  )
}

function RoutineVisual() {
  const rows = [
    { t: '06:00', l: 'Acordar', done: true },
    { t: '06:10', l: 'Água + alongar', done: true },
    { t: '06:30', l: 'Treino A', done: false },
    { t: '08:00', l: 'Bloco de foco', done: false },
  ]
  return (
    <ul className="w-64 space-y-2">
      {rows.map((r, k) => (
        <li
          key={r.l}
          className={cn(
            'flex items-center gap-3 rounded-md border px-3 py-2.5',
            r.done ? 'border-line bg-surface' : 'border-line-strong bg-elevated',
          )}
          style={{ opacity: 1 - k * 0.12 }}
        >
          <span className="tabular w-11 text-[12px] text-ink-faint">{r.t}</span>
          <span className={cn('flex-1 text-[14px]', r.done && 'text-ink-muted line-through')}>{r.l}</span>
          <span
            className={cn(
              'flex size-5 items-center justify-center rounded-full border',
              r.done ? 'border-accent bg-accent text-on-accent' : 'border-line-strong',
            )}
          >
            {r.done && (
              <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2.5 6.5l2.5 2.5 4.5-5" />
              </svg>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

function WakeVisual() {
  return (
    <div className="flex w-64 flex-col items-center gap-4 rounded-xl border border-line bg-surface p-5">
      <span className="tabular text-[52px] leading-none font-semibold tracking-[-0.04em]">06:00</span>
      <div className="relative h-14 w-full overflow-hidden rounded-lg border border-line-strong bg-elevated">
        <m.div
          className="absolute inset-y-0 left-0 bg-accent"
          initial={{ width: '0%' }}
          animate={{ width: ['0%', '100%', '100%', '0%'] }}
          transition={{ duration: 4.5, times: [0, 0.6, 0.85, 1], repeat: Infinity, ease: 'linear' }}
        />
        <span className="relative z-10 flex h-full items-center justify-center text-[15px] font-semibold mix-blend-difference">
          Segure para confirmar
        </span>
      </div>
    </div>
  )
}
