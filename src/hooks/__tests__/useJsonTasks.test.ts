import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useJsonTasks } from '../useJsonTasks'
import { LARGE_JSON_THRESHOLD } from '../../utils/jsonRunner'

class MockWorker {
  static instances: MockWorker[] = []
  onmessage?: (event: MessageEvent) => void
  onerror?: () => void
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() { MockWorker.instances.push(this) }
  reply(output: string) { this.onmessage?.({ data: { output } } as MessageEvent) }
}
const large = JSON.stringify({ text: 'x'.repeat(LARGE_JSON_THRESHOLD) })
beforeEach(() => { vi.useFakeTimers(); MockWorker.instances = []; vi.stubGlobal('Worker', MockWorker) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
const settle = async () => { await act(async () => { await Promise.resolve() }) }

describe('JSON tasks', () => {
  it('debounces large previews, discards superseded results and keeps documents isolated', async () => {
    const { result, unmount } = renderHook(useJsonTasks)
    const oldResult = vi.fn(), latest = vi.fn(), second = vi.fn()
    act(() => { result.current.process('a', large, 'format', 2, oldResult, true); vi.advanceTimersByTime(300) })
    const oldWorker = MockWorker.instances[0]
    act(() => {
      result.current.process('a', large + ' ', 'compress', 2, latest, true)
      result.current.process('b', large, 'format', 4, second, true)
      vi.advanceTimersByTime(299)
    })
    expect(MockWorker.instances).toHaveLength(1)
    expect(oldWorker.terminate).toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1); oldWorker.reply('stale'); MockWorker.instances[2].reply('doc b'); MockWorker.instances[1].reply('latest a') })
    await settle()
    expect(oldResult).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith({ output: 'latest a', error: '' })
    expect(second).toHaveBeenCalledWith({ output: 'doc b', error: '' })
    expect(result.current.busyIds).toEqual([])
    unmount()
  })
  it('cancels on clear/unmount and reports timeouts without retaining workers', async () => {
    const { result, unmount } = renderHook(useJsonTasks)
    const callback = vi.fn()
    act(() => { result.current.process('a', large, 'format', 2, callback); vi.advanceTimersByTime(0); result.current.cancel('a') })
    expect(MockWorker.instances[0].terminate).toHaveBeenCalled()
    await settle()
    expect(callback).not.toHaveBeenCalled()
    act(() => { result.current.process('b', large, 'format', 2, callback); vi.advanceTimersByTime(15_001) })
    await settle()
    expect(callback).toHaveBeenCalledWith({ output: '', error: expect.stringContaining('处理超时') })
    expect(MockWorker.instances[1].terminate).toHaveBeenCalled()
    act(() => { result.current.process('c', large, 'format', 2, callback); vi.advanceTimersByTime(0) })
    unmount()
    expect(MockWorker.instances[2].terminate).toHaveBeenCalled()
  })
})
