import '@testing-library/jest-dom'

const createMemoryStorage = (): Storage => {
  let store: Record<string, string> = {}

  return {
    get length() {
      return Object.keys(store).length
    },
    clear() {
      store = {}
    },
    getItem(key: string) {
      return store[key] ?? null
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null
    },
    removeItem(key: string) {
      delete store[key]
    },
    setItem(key: string, value: string) {
      store[key] = String(value)
    },
  }
}

const ensureUsableLocalStorage = () => {
  if (typeof window === 'undefined') return

  let storage: Storage | null = null
  try {
    storage = window.localStorage
  } catch {
    storage = null
  }

  if (!storage || typeof storage.clear !== 'function') {
    storage = createMemoryStorage()
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
    })
  }

  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  })
}

ensureUsableLocalStorage()
