import { useSyncExternalStore } from 'react'
import english from './locales/en.json'

export type Locale = 'en' | 'zh'
export const LOCALE_STORAGE_KEY = 'dev-tools:locale'
const messages: Record<string, string> = english
const listeners = new Set<() => void>()

const readLocale = (): Locale => {
  try { return window.localStorage.getItem(LOCALE_STORAGE_KEY) === 'zh' ? 'zh' : 'en' }
  catch { return 'en' }
}
let locale = readLocale()

export const getLocale = () => locale

export const setLocale = (next: Locale) => {
  if (next !== 'en' && next !== 'zh') return
  locale = next
  if (typeof document !== 'undefined') document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'
  try { window.localStorage.setItem(LOCALE_STORAGE_KEY, next) } catch { /* Language switching also works without storage. */ }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

// Source-language keys keep copy auditable; only UI copy is passed here.
export const t = (key: string, params: Record<string, string | number> = {}): string => {
  const message = locale === 'en' ? messages[key] ?? key : key
  return message.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : token)
}

export const useLocale = () => useSyncExternalStore(subscribe, getLocale, () => 'en' as const)

if (typeof document !== 'undefined') document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
