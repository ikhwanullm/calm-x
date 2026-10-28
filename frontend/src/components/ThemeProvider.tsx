import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '../api/settings'
import { settingsKeys } from '../hooks/useSettings'

export type Theme = 'system' | 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'calm-x-theme'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme): 'light' | 'dark' {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  const root = document.documentElement
  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  return resolved
}

function readLocalTheme(): Theme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system'
  } catch {
    return 'system'
  }
}

function writeLocalTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* localStorage may be unavailable */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize from localStorage immediately (no flash of wrong theme)
  const [theme, setThemeState] = useState<Theme>(() => readLocalTheme())
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => applyTheme(theme))
  const qc = useQueryClient()
  const syncedFromBackend = useRef(false)

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    const resolved = applyTheme(theme)
    setResolvedTheme(resolved)
  }, [theme])

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const resolved = applyTheme('system')
      setResolvedTheme(resolved)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [theme])

  // On mount: fetch from backend, update if different from localStorage.
  // Fall back silently if API is unavailable.
  useEffect(() => {
    if (syncedFromBackend.current) return
    syncedFromBackend.current = true

    settingsApi.get().then(prefs => {
      const backendTheme = prefs.theme as Theme | undefined
      if (backendTheme && ['system', 'light', 'dark'].includes(backendTheme)) {
        // Sync localStorage and state to backend value (backend is canonical)
        writeLocalTheme(backendTheme)
        setThemeState(backendTheme)
      }
    }).catch(() => {
      // API unavailable — localStorage value already applied, continue silently
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Set the active theme.
   * Updates localStorage immediately, then persists to the backend.
   * Invalidates the settings query so other components see the new value.
   */
  function setTheme(newTheme: Theme) {
    writeLocalTheme(newTheme)
    setThemeState(newTheme)

    // Persist to backend (fire and forget — failure is non-fatal)
    settingsApi.update({ theme: newTheme })
      .then(() => {
        qc.invalidateQueries({ queryKey: settingsKeys.all })
      })
      .catch(() => {
        // Backend unavailable; localStorage already has the value
      })
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
