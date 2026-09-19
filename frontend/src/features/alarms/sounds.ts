import type { AlarmSound } from '@/lib/types'

/**
 * Sons do alarme sintetizados na Web Audio API: sem arquivo de áudio, sem download, sem
 * licença. Cada som é um padrão curto repetido em loop até `stop()`.
 *
 * Navegadores só deixam tocar depois de um gesto do usuário. `unlockAudio()` é chamado no
 * primeiro toque em qualquer tela para que a tela de alarme consiga tocar mesmo quando abre
 * sozinha (relógio local ou clique na notificação).
 */

export const SOUND_LABELS: Record<AlarmSound, string> = {
  classic: 'Clássico',
  soft: 'Suave',
  pulse: 'Pulso',
}

export const SOUND_HINTS: Record<AlarmSound, string> = {
  classic: 'Bipes firmes, sobe de volume aos poucos.',
  soft: 'Toques de sino, para acordar sem susto.',
  pulse: 'Batida grave e constante.',
}

let ctx: AudioContext | null = null

function context(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

/** Cria/resume o AudioContext dentro de um gesto do usuário. Idempotente e barato. */
export function unlockAudio(): void {
  try {
    const c = context()
    if (c.state === 'suspended') void c.resume()
  } catch {
    // Sem Web Audio (ambiente muito antigo): a tela de alarme ainda funciona, só sem som.
  }
}

interface Voice {
  osc: OscillatorNode
  gain: GainNode
}

function voice(c: AudioContext, out: AudioNode, type: OscillatorType, freq: number): Voice {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.value = 0
  osc.connect(gain).connect(out)
  return { osc, gain }
}

/** Um "toque" com envelope ADSR curto em `at` (segundos do relógio do contexto). */
function blip(v: Voice, at: number, dur: number, peak: number, attack = 0.01, release = 0.06) {
  const g = v.gain.gain
  g.cancelScheduledValues(at)
  g.setValueAtTime(0, at)
  g.linearRampToValueAtTime(peak, at + attack)
  g.setValueAtTime(peak, at + dur - release)
  g.linearRampToValueAtTime(0, at + dur)
}

export interface AlarmPlayer {
  start: () => void
  stop: () => void
}

/**
 * Toca `sound` em loop. `rampSeconds` faz o volume subir gradualmente (0 → 1) para acordar
 * sem susto; a prévia usa 0.
 */
export function createAlarmPlayer(sound: AlarmSound, rampSeconds = 20): AlarmPlayer {
  let c: AudioContext
  try {
    c = context()
  } catch {
    return { start() {}, stop() {} }
  }
  const master = c.createGain()
  master.gain.value = 0
  master.connect(c.destination)
  let voices: Voice[] = []
  let timer: number | null = null
  let running = false

  // Cada padrão agenda um ciclo e devolve a duração do ciclo em segundos.
  const patterns: Record<AlarmSound, (at: number) => number> = {
    classic(at) {
      const v = voices[0]!
      for (let i = 0; i < 4; i++) blip(v, at + i * 0.18, 0.12, 0.6)
      return 1.2
    },
    soft(at) {
      const [a, b] = voices as [Voice, Voice]
      blip(a, at, 0.9, 0.35, 0.02, 0.6)
      blip(b, at + 0.45, 1.1, 0.25, 0.02, 0.8)
      return 2.4
    },
    pulse(at) {
      const v = voices[0]!
      blip(v, at, 0.22, 0.7, 0.005, 0.12)
      blip(v, at + 0.3, 0.22, 0.7, 0.005, 0.12)
      return 1.0
    },
  }

  function build() {
    if (sound === 'classic') voices = [voice(c, master, 'square', 880)]
    else if (sound === 'soft') voices = [voice(c, master, 'sine', 659.25), voice(c, master, 'sine', 987.77)]
    else voices = [voice(c, master, 'triangle', 220)]
    voices.forEach((v) => v.osc.start())
  }

  function schedule(at: number) {
    if (!running) return
    const cycle = patterns[sound](at)
    // Agenda o próximo ciclo um pouco antes de este acabar (relógio do áudio, não do JS).
    const delayMs = Math.max(0, (at + cycle - c.currentTime) * 1000 - 60)
    timer = window.setTimeout(() => schedule(at + cycle), delayMs)
  }

  return {
    start() {
      if (running) return
      running = true
      if (c.state === 'suspended') void c.resume()
      build()
      const now = c.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(rampSeconds > 0 ? 0.15 : 1, now)
      if (rampSeconds > 0) master.gain.linearRampToValueAtTime(1, now + rampSeconds)
      schedule(now + 0.05)
    },
    stop() {
      if (!running) return
      running = false
      if (timer) window.clearTimeout(timer)
      timer = null
      const now = c.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(0, now + 0.08)
      const done = voices
      voices = []
      window.setTimeout(() => {
        done.forEach((v) => {
          try {
            v.osc.stop()
            v.osc.disconnect()
          } catch {
            /* já parado */
          }
        })
        master.disconnect()
      }, 120)
    },
  }
}

/** Prévia curta para o editor de alarme (2 ciclos, sem rampa). */
export function previewSound(sound: AlarmSound, ms = 2500): () => void {
  unlockAudio()
  const p = createAlarmPlayer(sound, 0)
  p.start()
  const t = window.setTimeout(() => p.stop(), ms)
  return () => {
    window.clearTimeout(t)
    p.stop()
  }
}
