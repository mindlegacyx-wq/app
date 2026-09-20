/**
 * Sons curtos gerados no navegador (Web Audio) — nenhum arquivo para baixar.
 *
 * Usado só em momentos raros e comemorativos (subir de nível). Marcar um item não toca som:
 * o gesto se repete dezenas de vezes por dia e viraria irritação.
 */

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null // navegador sem Web Audio ou bloqueado: silêncio, sem quebrar nada
  }
}

function note(c: AudioContext, freq: number, start: number, duration: number, gain = 0.12) {
  const osc = c.createOscillator()
  const amp = c.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, c.currentTime + start)
  amp.gain.setValueAtTime(0, c.currentTime + start)
  amp.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.02)
  amp.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + duration)
  osc.connect(amp).connect(c.destination)
  osc.start(c.currentTime + start)
  osc.stop(c.currentTime + start + duration + 0.05)
}

/** Arpejo ascendente de vitória (sol–si–ré–sol). */
export function levelUpSound() {
  const c = context()
  if (!c) return
  const steps = [392, 493.88, 587.33, 783.99]
  steps.forEach((f, i) => note(c, f, i * 0.09, 0.5 - i * 0.05, i === steps.length - 1 ? 0.16 : 0.1))
}

/** Vibração curta (Android). Silenciosa no iOS, que não expõe a API. */
export function buzz(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* sem vibração */
  }
}
