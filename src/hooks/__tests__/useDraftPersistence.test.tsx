import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDraftPersistence } from '../useDraftPersistence'
import { readExpiringStorage, setDraftSettings, writeExpiringStorage } from '../../utils/expiringStorage'

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }))
vi.mock('../../components/toastContext', () => ({ useToast: () => ({ showToast }) }))
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); showToast.mockClear() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('draft persistence', () => {
  it('uses the latest retention setting when a pending draft is automatically saved', () => {
    const { unmount } = renderHook(() => useDraftPersistence('draft', 'content'))
    setDraftSettings({ enabled: true, days: 30 })
    act(() => { vi.advanceTimersByTime(600) })
    expect(JSON.parse(localStorage.getItem('draft')!).expiresAt).toBe(Date.now() + 30 * 24 * 60 * 60 * 1000)
    unmount()
  })

  it('coalesces rapid edits and writes the latest value after idle', () => {
    const { rerender, unmount } = renderHook(({ value }) => useDraftPersistence('draft', value), { initialProps: { value: 'first' } })
    rerender({ value: 'second' })
    act(() => { vi.advanceTimersByTime(599) })
    expect(readExpiringStorage('draft')).toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    expect(readExpiringStorage('draft')).toBe('second')
    unmount()
  })

  it('cancels queued saves and skips writes while autosave is disabled', () => {
    writeExpiringStorage('draft', 'previously saved')
    const { rerender, unmount } = renderHook(({ value }) => useDraftPersistence('draft', value), { initialProps: { value: 'pending' } })
    setDraftSettings({ enabled: false, days: 2 })
    rerender({ value: 'private edit' })
    act(() => {
      vi.advanceTimersByTime(600)
      window.dispatchEvent(new Event('pagehide'))
    })
    unmount()
    expect(readExpiringStorage('draft')).toBe('previously saved')
  })

  it('clears only this draft and resumes on a new edit, even if a preview finishes later', () => {
    writeExpiringStorage('draft', 'previously saved')
    writeExpiringStorage('another-draft', 'keep')
    const { result, rerender, unmount } = renderHook(({ value, revision }) => useDraftPersistence('draft', value, revision), {
      initialProps: { value: 'pending', revision: 1 },
    })
    act(() => result.current())
    rerender({ value: 'preview finished', revision: 1 })
    act(() => {
      vi.advanceTimersByTime(600)
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(localStorage.getItem('draft')).toBeNull()
    expect(readExpiringStorage('another-draft')).toBe('keep')
    rerender({ value: 'new edit', revision: 2 })
    unmount()
    expect(readExpiringStorage('draft')).toBe('new edit')
  })
  it('flushes on pagehide, visibility hidden and unmount, including StrictMode', () => {
    const { rerender, unmount } = renderHook(({ value }) => useDraftPersistence('draft', value), {
      initialProps: { value: 'first' }, wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    })
    rerender({ value: 'second' })
    act(() => { window.dispatchEvent(new Event('pagehide')) })
    expect(readExpiringStorage('draft')).toBe('second')
    rerender({ value: 'third' })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(readExpiringStorage('draft')).toBe('third')
    rerender({ value: 'last' })
    unmount()
    expect(readExpiringStorage('draft')).toBe('last')
  })
  it('reports quota failure once and retries the unsaved latest draft', () => {
    // Native jsdom Storage uses a Proxy; the test fallback stores methods on the instance.
    const storageTarget = Object.hasOwn(localStorage, 'setItem') ? localStorage : Storage.prototype
    const setItem = vi.spyOn(storageTarget, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    const { rerender, unmount } = renderHook(({ value }) => useDraftPersistence('draft', value), { initialProps: { value: 'first' } })
    act(() => { vi.advanceTimersByTime(600) })
    rerender({ value: 'second' })
    act(() => { vi.advanceTimersByTime(600) })
    expect(showToast).toHaveBeenCalledTimes(1)
    setItem.mockRestore()
    act(() => { window.dispatchEvent(new Event('pagehide')) })
    expect(readExpiringStorage('draft')).toBe('second')
    unmount()
  })
})
