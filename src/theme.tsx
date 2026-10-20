import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, type AppTheme, type ThemeContextValue } from './themeContext'

const THEME_STORAGE_KEY = 'dev-tools:theme'

const readStoredTheme = (): AppTheme => {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<AppTheme>(readStoredTheme)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Private browsing or a restricted storage policy should not block theme switching.
    }
  }, [theme])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    monacoTheme: theme === 'light' ? 'vs' : 'vs-dark',
    toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark'),
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
