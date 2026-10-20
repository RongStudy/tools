import { createContext, useContext } from 'react'

export type AppTheme = 'dark' | 'light'

export type ThemeContextValue = {
  theme: AppTheme
  monacoTheme: 'vs-dark' | 'vs'
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  monacoTheme: 'vs-dark',
  toggleTheme: () => {},
})

export const useAppTheme = (): ThemeContextValue => useContext(ThemeContext)
