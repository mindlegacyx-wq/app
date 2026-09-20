import { useEffect, useState } from 'react'

/** Largura a partir da qual o app usa o formato de PC (menu lateral, duas colunas). */
export const DESKTOP_QUERY = '(min-width: 1024px)'

/**
 * Acompanha uma media query. Serve para o que o CSS sozinho não resolve — animação e
 * comportamento —; layout continua sendo decidido por classe (`lg:`), que não depende de JS.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY)
}
