import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ThemeContext, type AppTheme, type AppThemePreference, type ThemeContextValue } from './themeContext'

const THEME_STORAGE_KEY = 'dev-tools:theme'
const LIGHT_SCHEME_QUERY = '(prefers-color-scheme: light)'

const readThemePreference = (): AppThemePreference => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

const readSystemTheme = (): AppTheme => (
  window.matchMedia?.(LIGHT_SCHEME_QUERY).matches ? 'light' : 'dark'
)

const subscribeToSystemTheme = (onChange: () => void) => {
  const media = window.matchMedia?.(LIGHT_SCHEME_QUERY)
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themePreference, setThemePreference] = useState<AppThemePreference>(readThemePreference)
  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, readSystemTheme)
  const theme = themePreference === 'system' ? systemTheme : themePreference

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)
    } catch {
      // Private browsing or a restricted storage policy should not block theme switching.
    }
  }, [themePreference])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    monacoTheme: theme === 'light' ? 'vs' : 'vs-dark',
    themePreference,
    setThemePreference,
  }), [theme, themePreference])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
