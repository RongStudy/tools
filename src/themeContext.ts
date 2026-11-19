import { createContext, useContext } from 'react'

export type AppTheme = 'dark' | 'light'
export type AppThemePreference = AppTheme | 'system'

export type ThemeContextValue = {
  theme: AppTheme
  monacoTheme: 'vs-dark' | 'vs'
  themePreference: AppThemePreference
  setThemePreference: (preference: AppThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  monacoTheme: 'vs-dark',
  themePreference: 'system',
  setThemePreference: () => {},
})

export const useAppTheme = (): ThemeContextValue => useContext(ThemeContext)
