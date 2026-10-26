import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDraftRetentionDays, readExpiringStorage, setDraftRetentionDays, TWO_DAYS_IN_MS, writeExpiringStorage } from './expiringStorage'

const DAY = 24 * 60 * 60 * 1000

beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('configurable draft retention', () => {
  it('defaults to two days and expires drafts when next read', () => {
    expect(getDraftRetentionDays()).toBe(2)
    writeExpiringStorage('draft', 'content')
    vi.advanceTimersByTime(TWO_DAYS_IN_MS - 1)
    expect(readExpiringStorage('draft')).toBe('content')
    vi.advanceTimersByTime(1)
    expect(readExpiringStorage('draft')).toBeNull()
    expect(localStorage.getItem('draft')).toBeNull()
  })

  it('uses the stored setting for subsequent saves and restarts expiry on each save', () => {
    writeExpiringStorage('draft', 'original')
    expect(setDraftRetentionDays(7)).toBe(true)
    expect(getDraftRetentionDays()).toBe(7)
    // Changing the setting alone does not rewrite existing drafts.
    expect(JSON.parse(localStorage.getItem('draft')!).expiresAt).toBe(Date.now() + 2 * DAY)
    writeExpiringStorage('draft', 'updated')
    vi.advanceTimersByTime(6 * DAY)
    expect(readExpiringStorage('draft')).toBe('updated')
    writeExpiringStorage('draft', 'latest')
    vi.advanceTimersByTime(7 * DAY - 1)
    expect(readExpiringStorage('draft')).toBe('latest')
    vi.advanceTimersByTime(1)
    expect(readExpiringStorage('draft')).toBeNull()
    expect(getDraftRetentionDays()).toBe(7)
  })

  it.each([0, -1, 1.5, 366, NaN, Infinity])('rejects invalid retention %s without replacing the preference', (days) => {
    setDraftRetentionDays(7)
    expect(setDraftRetentionDays(days)).toBe(false)
    expect(getDraftRetentionDays()).toBe(7)
    localStorage.setItem('dev-tools:draft-retention-days', String(days))
    expect(getDraftRetentionDays()).toBe(2)
  })

  it('preserves explicit TTL overrides for layout preferences', () => {
    setDraftRetentionDays(30)
    writeExpiringStorage('split-ratio', 30, TWO_DAYS_IN_MS)
    vi.advanceTimersByTime(TWO_DAYS_IN_MS)
    expect(readExpiringStorage('split-ratio')).toBeNull()
  })

  it('reports storage failures without throwing or changing the saved preference', () => {
    setDraftRetentionDays(7)
    const storageTarget = Object.hasOwn(localStorage, 'setItem') ? localStorage : Storage.prototype
    vi.spyOn(storageTarget, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    expect(setDraftRetentionDays(30)).toBe(false)
    expect(getDraftRetentionDays()).toBe(7)
    vi.spyOn(storageTarget, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError') })
    expect(getDraftRetentionDays()).toBe(2)
  })
})
