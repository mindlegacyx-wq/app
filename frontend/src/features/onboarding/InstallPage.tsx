import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { Button, Card } from '@/components/ui'

type Platform = 'ios' | 'android' | 'desktop'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export function InstallPage() {
  const navigate = useNavigate()
  const [platform] = useState<Platform>(detectPlatform)
  const [installed, setInstalled] = useState(isStandalone)
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!promptEvent) return
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setPromptEvent(null)
  }

  return (
    <div className="safe-top flex min-h-dvh flex-col pt-8">
      <p className="text-[13px] font-semibold tracking-[0.08em] text-accent uppercase">Último passo</p>
      <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.03em]">Instale na tela inicial.</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
        Instalado, o app abre em tela cheia, funciona offline e pode receber o aviso do despertador.
        {platform === 'ios' && ' No iPhone, isso é obrigatório para as notificações.'}
      </p>

      <Card className="mt-8">
        {installed ? (
          <p className="text-[15px]">
            <span className="font-semibold text-accent">Instalado.</span> Você já está usando o app pela tela inicial.
          </p>
        ) : platform === 'ios' ? (
          <Steps
            steps={[
              <>
                Toque em <b>Compartilhar</b> <ShareIcon /> na barra do Safari.
              </>,
              <>
                Role e toque em <b>Adicionar à Tela de Início</b>.
              </>,
              <>
                Confirme em <b>Adicionar</b> e abra o Disciplina pelo ícone.
              </>,
            ]}
          />
        ) : platform === 'android' ? (
          promptEvent ? (
            <div className="flex flex-col gap-3">
              <p className="text-[15px]">Seu navegador permite instalar com um toque.</p>
              <Button onClick={install}>Instalar agora</Button>
            </div>
          ) : (
            <Steps
              steps={[
                <>
                  Toque no menu <b>⋮</b> do Chrome.
                </>,
                <>
                  Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.
                </>,
                <>Abra o Disciplina pelo ícone.</>,
              ]}
            />
          )
        ) : promptEvent ? (
          <div className="flex flex-col gap-3">
            <p className="text-[15px]">Dá para instalar como app no computador também.</p>
            <Button onClick={install}>Instalar</Button>
          </div>
        ) : (
          <p className="text-[15px] text-ink-muted">
            No computador, use o ícone de instalar na barra de endereço do navegador. No celular, abra este mesmo
            endereço para instalar.
          </p>
        )}
      </Card>

      <div className="mt-auto flex flex-col gap-2 pt-8 pb-6">
        <Button size="lg" full onClick={() => navigate('/hoje', { replace: true })}>
          {installed ? 'Ir para Hoje' : 'Já instalei'}
        </Button>
        {!installed && (
          <Button variant="ghost" full onClick={() => navigate('/hoje', { replace: true })}>
            Fazer isso depois
          </Button>
        )}
      </div>
    </div>
  )
}

function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
          <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent">
            {i + 1}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  )
}

function ShareIcon() {
  return (
    <svg className="inline size-4 -translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}
