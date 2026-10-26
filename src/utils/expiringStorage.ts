const DAY_IN_MS = 24 * 60 * 60 * 1000
export const TWO_DAYS_IN_MS = 2 * DAY_IN_MS
export const DEFAULT_DRAFT_RETENTION_DAYS = 2
export const MAX_DRAFT_RETENTION_DAYS = 365
const DRAFT_RETENTION_KEY = 'dev-tools:draft-retention-days'

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

export const getDraftRetentionDays = (): number => {
  try {
    const days = Number(getLocalStorage()?.getItem(DRAFT_RETENTION_KEY))
    return isValidRetentionDays(days) ? days : DEFAULT_DRAFT_RETENTION_DAYS
  } catch {
    return DEFAULT_DRAFT_RETENTION_DAYS
  }
}

export const setDraftRetentionDays = (days: number): boolean => {
  if (!isValidRetentionDays(days)) return false
  const storage = getLocalStorage()
  if (!storage) return false
  try {
    storage.setItem(DRAFT_RETENTION_KEY, String(days))
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
