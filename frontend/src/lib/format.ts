const LOCALE = 'pt-BR'

export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 5) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** "sexta-feira, 18 de setembro" */
export function longDate(date = new Date()): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

/** "18/09/2026 às 21:04" */
export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

/** "06:00:00" → "06:00" */
export function shortTime(hms: string | null | undefined): string {
  return hms ? hms.slice(0, 5) : '--:--'
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return 'Dispositivo desconhecido'
  const ua = userAgent
  const os = /iPhone|iPad/.test(ua)
    ? 'iPhone'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS/.test(ua)
        ? 'Mac'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Dispositivo'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Safari\//.test(ua)
        ? 'Safari'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : 'navegador'
  return `${os} · ${browser}`
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    return 'America/Sao_Paulo'
  }
}

export const cn = (...parts: Array<string | number | false | null | undefined>) =>
  parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ')

/** "YYYY-MM-DD" de hoje no fuso do usuário (não no do aparelho). */
export function todayIn(timezone: string, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at)
  } catch {
    return at.toISOString().slice(0, 10)
  }
}

/** "06:12" a partir de um instante ISO, no fuso do usuário. */
export function timeIn(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(iso))
  } catch {
    return iso.slice(11, 16)
  }
}

export const WEEKDAYS_SHORT = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const
export const WEEKDAYS_LONG = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'] as const

/** "todos os dias" · "seg a sex" · "seg, qua e sex" */
export function describeDays(days: number[]): string {
  const d = [...days].sort((a, b) => a - b)
  if (d.length === 7) return 'todos os dias'
  if (d.join() === '0,1,2,3,4') return 'seg a sex'
  if (d.join() === '5,6') return 'fim de semana'
  const names = d.map((i) => WEEKDAYS_LONG[i]!.slice(0, 3))
  if (names.length === 1) return names[0]!
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
