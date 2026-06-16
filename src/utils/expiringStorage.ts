export const TWO_DAYS_IN_MS = 2 * 24 * 60 * 60 * 1000

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
  ttlMs = TWO_DAYS_IN_MS
) => {
  const storage = getLocalStorage()
  if (!storage) return

  try {
    const payload: ExpiringStoragePayload<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    }
    storage.setItem(key, JSON.stringify(payload))
  } catch {
    // localStorage may be unavailable or full; failing to persist should not break editing.
  }
}
