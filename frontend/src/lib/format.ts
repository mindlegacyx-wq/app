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
