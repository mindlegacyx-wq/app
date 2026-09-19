import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { Button, Card } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/format'
import { disablePush, enablePush, getPushDeviceState, isIOS, isStandalone, type PushDeviceState } from '@/lib/push'
import type { PushStatus } from '@/lib/types'

import { pushKeys, usePushStatus } from './api'

/** Estado das notificações neste aparelho + botão para ativar/desativar. */
export function PushDeviceCard({ compact = false, className }: { compact?: boolean; className?: string }) {
  const qc = useQueryClient()
  const status = usePushStatus()
  const [state, setState] = useState<PushDeviceState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => setState(await getPushDeviceState(status.data))
  useEffect(() => {
    if (status.data) void getPushDeviceState(status.data).then(setState)
  }, [status.data])

  const toggle = useMutation({
    mutationFn: async () => {
      setError(null)
      if (state === 'on') await disablePush()
      else if (status.data?.public_key) await enablePush(status.data.public_key)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pushKeys.status })
      void refresh()
    },
    onError: (e) => {
      setError(errorMessage(e))
      void refresh()
    },
  })

  const copy = describe(state, status.data)
  const canToggle = state === 'on' || state === 'off'

  return (
    <Card className={cn('flex items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[15px]">
          <span className={cn('size-2 shrink-0 rounded-full', state === 'on' ? 'bg-accent' : state === 'denied' || state === 'unsupported' ? 'bg-danger' : 'bg-ink-faint')} />
          {copy.title}
        </p>
        {!compact && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-faint">{copy.hint}</p>}
        {error && <p className="mt-1 text-[13px] text-danger">{error}</p>}
      </div>
      {canToggle && (
        <Button size="sm" variant={state === 'on' ? 'ghost' : 'primary'} loading={toggle.isPending} onClick={() => toggle.mutate()}>
          {state === 'on' ? 'Desativar' : 'Ativar'}
        </Button>
      )}
    </Card>
  )
}

function describe(state: PushDeviceState | null, status: PushStatus | undefined): { title: string; hint: string } {
  switch (state) {
    case 'on':
      return { title: 'Notificações ativas neste aparelho', hint: 'O alarme chega mesmo com o app fechado. Deixe o som do celular ligado.' }
    case 'off':
      return {
        title: 'Notificações desligadas neste aparelho',
        hint:
          isIOS() && !isStandalone()
            ? 'No iPhone, instale o app na tela inicial antes de ativar.'
            : 'Ative para o alarme tocar com o app fechado. Com o app aberto ele toca de qualquer jeito.',
      }
    case 'denied':
      return { title: 'Notificações bloqueadas no navegador', hint: 'Libere nas configurações do site/app para receber o alarme com o app fechado.' }
    case 'unsupported':
      return { title: 'Este navegador não recebe notificações', hint: 'O alarme toca só com o app aberto. No celular, instale o app na tela inicial.' }
    case 'server_off':
      return { title: 'Notificações indisponíveis nesta instalação', hint: 'O servidor ainda não tem chaves de push. O alarme toca com o app aberto.' }
    default:
      return { title: status ? 'Verificando…' : 'Notificações', hint: '' }
  }
}
