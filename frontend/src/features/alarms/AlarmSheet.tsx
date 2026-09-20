import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'

import { Button, DayPicker, Dialog, Field, Sheet, Toggle } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/format'
import type { Alarm, AlarmSound, AlarmSoundFile } from '@/lib/types'

import { prefetchAlarmSound, forgetAlarmSound, playLoop, alarmSoundUrl } from './audio'
import {
  useAlarmSounds,
  useCreateAlarm,
  useDeleteAlarm,
  useDeleteAlarmSound,
  useUpdateAlarm,
  useUploadAlarmSound,
} from './api'
import { SOUND_HINTS, SOUND_LABELS, previewSound } from './sounds'

interface Props {
  open: boolean
  onClose: () => void
  alarm?: Alarm
}

/** Tela 12: horário, dias, som (com prévia), confirmação obrigatória, sonecas. */
export function AlarmSheet({ open, onClose, alarm }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={alarm ? 'Editar alarme' : 'Novo alarme'}>
      <AlarmForm alarm={alarm} onClose={onClose} />
    </Sheet>
  )
}

const SOUNDS: AlarmSound[] = ['classic', 'soft', 'pulse']
const SNOOZE_COUNTS = [0, 1, 2, 3] as const
const SNOOZE_MINUTES = [5, 10, 15] as const

function AlarmForm({ alarm, onClose }: { alarm?: Alarm; onClose: () => void }) {
  const create = useCreateAlarm()
  const update = useUpdateAlarm()
  const remove = useDeleteAlarm()

  const [label, setLabel] = useState(alarm?.label ?? 'Acordar')
  const [time, setTime] = useState(alarm?.time.slice(0, 5) ?? '06:00')
  const [days, setDays] = useState<number[]>(alarm?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6])
  const [sound, setSound] = useState<AlarmSound>(alarm?.sound ?? 'classic')
  const [soundFileId, setSoundFileId] = useState<string | null>(alarm?.sound_file_id ?? null)
  const [insist, setInsist] = useState(alarm?.insist ?? true)
  const sounds = useAlarmSounds()
  const upload = useUploadAlarmSound()
  const removeSound = useDeleteAlarmSound()
  const [requiresConfirmation, setRequiresConfirmation] = useState(alarm?.requires_confirmation ?? true)
  const [maxSnoozes, setMaxSnoozes] = useState(alarm?.max_snoozes ?? 1)
  const [snoozeMinutes, setSnoozeMinutes] = useState(alarm?.snooze_minutes ?? 5)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prévia do som: uma por vez; para ao fechar o sheet.
  const stopPreview = useRef<(() => void) | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null) // som pronto ou id do áudio
  useEffect(() => () => stopPreview.current?.(), [])
  function preview(s: AlarmSound) {
    stopPreview.current?.()
    if (previewing === s) {
      setPreviewing(null)
      return
    }
    setPreviewing(s)
    const stop = previewSound(s, 2600)
    stopPreview.current = () => {
      stop()
      setPreviewing(null)
    }
    window.setTimeout(() => setPreviewing((cur) => (cur === s ? null : cur)), 2600)
  }

  /** Prévia do áudio do usuário: 6 segundos, o bastante para reconhecer a música. */
  async function previewFile(file: AlarmSoundFile) {
    stopPreview.current?.()
    if (previewing === file.id) {
      setPreviewing(null)
      return
    }
    setPreviewing(file.id)
    try {
      const url = await alarmSoundUrl(file.id)
      const player = playLoop(url, () => setPreviewing(null))
      const timer = window.setTimeout(() => {
        player.stop()
        setPreviewing((cur) => (cur === file.id ? null : cur))
      }, 6000)
      stopPreview.current = () => {
        window.clearTimeout(timer)
        player.stop()
        setPreviewing(null)
      }
    } catch (err) {
      setPreviewing(null)
      setError(errorMessage(err))
    }
  }

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // deixa escolher o mesmo arquivo de novo
    if (!file) return
    setError(null)
    try {
      const saved = await upload.mutateAsync(file)
      setSoundFileId(saved.id)
      void prefetchAlarmSound(saved.id)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (days.length === 0) {
      setError('Escolha pelo menos um dia da semana.')
      return
    }
    const body = {
      label: label.trim() || 'Acordar',
      time,
      days_of_week: days,
      sound,
      sound_file_id: soundFileId,
      clear_sound_file: soundFileId === null,
      insist,
      requires_confirmation: requiresConfirmation,
      max_snoozes: maxSnoozes,
      snooze_minutes: snoozeMinutes,
    }
    try {
      if (alarm) await update.mutateAsync({ id: alarm.id, ...body })
      else await create.mutateAsync(body)
      stopPreview.current?.()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="alarm-time" className="text-[13px] font-medium text-ink-muted">
          Horário
        </label>
        <input
          id="alarm-time"
          type="time"
          required
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="tabular h-16 w-full rounded-md border border-line-strong bg-elevated px-4 text-center text-[36px] font-semibold tracking-[-0.03em] outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <Field label="Nome" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="Acordar" />

      <DayPicker value={days} onChange={setDays} />

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-muted">Som</span>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Som do alarme">
          {SOUNDS.map((s) => (
            <div key={s} className={cn('flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors', sound === s && soundFileId === null ? 'border-accent bg-accent-soft' : 'border-line-strong bg-elevated')}>
              <button type="button" role="radio" aria-checked={sound === s && soundFileId === null} onClick={() => { setSound(s); setSoundFileId(null) }} className="flex min-w-0 flex-1 flex-col text-left">
                <span className={cn('text-[15px] font-semibold', sound === s && soundFileId === null && 'text-accent')}>{SOUND_LABELS[s]}</span>
                <span className="text-[12px] text-ink-faint">{SOUND_HINTS[s]}</span>
              </button>
              <button
                type="button"
                aria-label={`${previewing === s ? 'Parar prévia de' : 'Ouvir'} ${SOUND_LABELS[s]}`}
                onClick={() => preview(s)}
                className={cn('flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted hover:text-ink', previewing === s && 'border-accent text-accent')}
              >
                {previewing === s ? (
                  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <rect x="6" y="6" width="12" height="12" rx="1.5" />
                  </svg>
                ) : (
                  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5.5v13l11-6.5z" />
                  </svg>
                )}
              </button>
            </div>
          ))}

          {sounds.data?.map((f) => (
            <div
              key={f.id}
              className={cn(
                'flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
                soundFileId === f.id ? 'border-accent bg-accent-soft' : 'border-line-strong bg-elevated',
              )}
            >
              <button
                type="button"
                role="radio"
                aria-checked={soundFileId === f.id}
                onClick={() => {
                  setSoundFileId(f.id)
                  void prefetchAlarmSound(f.id)
                }}
                className="flex min-w-0 flex-1 flex-col text-left"
              >
                <span className={cn('truncate text-[15px] font-semibold', soundFileId === f.id && 'text-accent')}>{f.name}</span>
                <span className="text-[12px] text-ink-faint">Seu áudio · {(f.size_bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB</span>
              </button>
              <button
                type="button"
                aria-label={`${previewing === f.id ? 'Parar prévia de' : 'Ouvir'} ${f.name}`}
                onClick={() => void previewFile(f)}
                className={cn('flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted', previewing === f.id && 'border-accent text-accent')}
              >
                {previewing === f.id ? (
                  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
                ) : (
                  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13l11-6.5z" /></svg>
                )}
              </button>
              <button
                type="button"
                aria-label={`Excluir ${f.name}`}
                onClick={() => {
                  if (soundFileId === f.id) setSoundFileId(null)
                  void forgetAlarmSound(f.id)
                  removeSound.mutate(f.id, { onError: (err) => setError(errorMessage(err)) })
                }}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-faint active:text-danger"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          ))}

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-line-strong py-2.5 text-[14px] font-medium text-ink-muted active:bg-elevated">
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 16V4M8 8l4-4 4 4M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
            </svg>
            {upload.isPending ? 'Enviando…' : 'Usar meu áudio'}
            <input type="file" accept="audio/*" className="sr-only" onChange={(e) => void pickFile(e)} disabled={upload.isPending} />
          </label>
          <p className="text-[12px] text-ink-faint">
            mp3, m4a, aac, ogg ou wav, até 5 MB. Com o app fechado quem toca é o som de notificação do celular — seu
            áudio toca quando a tela do alarme abre (e no modo cabeceira).
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-line-strong bg-elevated px-4 py-3">
        <div className="min-w-0">
          <p className="text-[15px]">Insistir até eu desligar</p>
          <p className="text-[12px] text-ink-faint">Repete a notificação a cada minuto. Desligado, avisa uma vez só.</p>
        </div>
        <Toggle label="Insistir até desligar" checked={insist} onChange={setInsist} />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-line-strong bg-elevated px-4 py-3">
        <div className="min-w-0">
          <p className="text-[15px]">Segurar 3 s para desligar</p>
          <p className="text-[12px] text-ink-faint">Desligado, um toque basta. O registro do horário continua.</p>
        </div>
        <Toggle label="Confirmação obrigatória" checked={requiresConfirmation} onChange={setRequiresConfirmation} />
      </div>

      <div className="flex flex-col gap-3">
        <Segmented
          label="Sonecas"
          hint="0 = o alarme não oferece soneca."
          options={SNOOZE_COUNTS.map((n) => ({
            value: n,
            label: String(n),
            ariaLabel: n === 0 ? 'Nenhuma soneca' : `${n} soneca${n > 1 ? 's' : ''}`,
          }))}
          value={maxSnoozes}
          onChange={setMaxSnoozes}
        />
        <Segmented label="Duração" options={SNOOZE_MINUTES.map((n) => ({ value: n, label: `${n} min` }))} value={snoozeMinutes} onChange={setSnoozeMinutes} disabled={maxSnoozes === 0} />
      </div>

      {error && <p className="text-[14px] text-danger">{error}</p>}

      <Button type="submit" size="lg" full loading={create.isPending || update.isPending} disabled={!time}>
        {alarm ? 'Salvar' : 'Criar alarme'}
      </Button>

      {alarm && (
        <Button type="button" variant="ghost" full className="text-danger" onClick={() => setConfirmDelete(true)}>
          Excluir alarme
        </Button>
      )}

      <Dialog
        open={confirmDelete}
        title="Excluir alarme?"
        description="O histórico de acordar continua. Sem alarme, o acordar vale pelo horário das configurações."
        confirmLabel="Excluir"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => alarm && remove.mutate(alarm.id, { onSuccess: onClose, onError: (e) => setError(errorMessage(e)) })}
      />
    </form>
  )
}

function Segmented<T extends number>({
  label,
  hint,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  options: { value: T; label: string; ariaLabel?: string }[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', disabled && 'opacity-50')}>
      <span className="text-[13px] font-medium text-ink-muted">{label}</span>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            aria-label={o.ariaLabel}
            className={cn(
              // min-w-0 + truncate: o texto fica dentro da célula em qualquer largura de tela.
              'tabular h-10 min-w-0 truncate rounded-sm border px-1 text-[13px] font-semibold transition-colors',
              value === o.value ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-elevated text-ink-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className="text-[12px] text-ink-faint">{hint}</p>}
    </div>
  )
}
