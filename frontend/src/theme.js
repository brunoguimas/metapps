import { useCallback, useEffect, useState } from 'react'

// ─── TEMA CLARO/ESCURO ────────────────────────────────────────────
//
// A escolha fica em localStorage e é aplicada como atributo no <html>.
// Usar um atributo (e não uma classe) deixa o tema aplicável também ao
// CSS global, e o atributo sobrevive a qualquer componente que monte e
// desmonte sem precisar reaplicar nada.

const STORAGE_KEY = 'metapps:theme'
const DEFAULT_THEME = 'dark'

// O tema é aplicado já no carregamento do documento (ver main.jsx) para
// evitar o "flash" de tema errado antes do React montar.
export function applyStoredTheme() {
  const theme = readStoredTheme()
  document.documentElement.setAttribute('data-theme', theme)
  return theme
}

export function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return null
  // A ausência de matchMedia é o caso de SSR/pré-render; devolvemos null
  // para quem chamou decidir o default.
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch { /* localStorage bloqueado: cai no default */ }

  // Sem escolha salva, seguimos o sistema; só então o default do app.
  return systemTheme() || DEFAULT_THEME
}

export function storeTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch { /* ignora: preferência só vive nesta sessão */ }
}

export function useTheme() {
  const [theme, setThemeState] = useState(readStoredTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    storeTheme(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, setTheme: setThemeState, toggleTheme }
}
