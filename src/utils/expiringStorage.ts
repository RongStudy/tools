const DAY_IN_MS = 24 * 60 * 60 * 1000
export const TWO_DAYS_IN_MS = 2 * DAY_IN_MS
export const DEFAULT_DRAFT_RETENTION_DAYS = 2
export const MAX_DRAFT_RETENTION_DAYS = 365
export const DRAFT_SETTINGS_KEY = 'dev-tools:draft-retention-days'
export const DRAFT_AUTOSAVE_DISABLED_EVENT = 'draft-autosave-disabled'

type DraftSettings = {
  enabled: boolean
  days: number
}

type ExpiringStoragePayload<T> = {
  value: T
  expiresAt: number
}

const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

const isValidRetentionDays = (days: number) => (
  Number.isInteger(days) && days >= 1 && days <= MAX_DRAFT_RETENTION_DAYS
)

export const getDraftSettings = (): DraftSettings => {
  const defaults = { enabled: true, days: DEFAULT_DRAFT_RETENTION_DAYS }
  try {
    const raw = getLocalStorage()?.getItem(DRAFT_SETTINGS_KEY)
    if (!raw) return defaults
    // Earlier versions stored only the retention period under this key.
    const saved = JSON.parse(raw) as Partial<DraftSettings> | number | null
    const days = typeof saved === 'number' ? saved : saved?.days
    return {
      enabled: typeof saved === 'number' || saved?.enabled !== false,
      days: typeof days === 'number' && isValidRetentionDays(days) ? days : defaults.days,
    }
  } catch {
    return defaults
  }
}

export const getDraftRetentionDays = (): number => getDraftSettings().days

export const setDraftSettings = (settings: DraftSettings): boolean => {
  if (!isValidRetentionDays(settings.days)) return false
  const storage = getLocalStorage()
  if (!storage) return false
  try {
    storage.setItem(DRAFT_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    return false
  }
  if (!settings.enabled) window.dispatchEvent(new Event(DRAFT_AUTOSAVE_DISABLED_EVENT))
  return true
}

export const removeExpiringStorage = (key: string): boolean => {
  const storage = getLocalStorage()
  if (!storage) return false
  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export const readExpiringStorage = <T>(key: string): T | null => {
  const storage = getLocalStorage()
  if (!storage) return null

  try {
    const rawValue = storage.getItem(key)
    if (!rawValue) return null

    const payload = JSON.parse(rawValue) as Partial<ExpiringStoragePayload<T>>
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt <= Date.now()) {
      storage.removeItem(key)
      return null
    }

    return payload.value as T
  } catch {
    storage.removeItem(key)
    return null
  }
}

export const writeExpiringStorage = <T>(
  key: string,
  value: T,
  ttlMs = getDraftRetentionDays() * DAY_IN_MS
) => {
  const storage = getLocalStorage()
  if (!storage) return false

  try {
    const payload: ExpiringStoragePayload<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    }
    storage.setItem(key, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}
