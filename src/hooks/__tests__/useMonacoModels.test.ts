import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as Monaco from 'monaco-editor'
import { modelPath, useMonacoModels } from '../useMonacoModels'

afterEach(() => vi.useRealTimers())

describe('document model lifetime', () => {
  it('keeps other tabs alive and disposes a closed document only after editors detach', () => {
    vi.useFakeTimers()
    const first = { dispose: vi.fn() }
    const second = { dispose: vi.fn() }
    const unrelated = { dispose: vi.fn() }
    const models = new Map([['one', first], ['two', second], ['unrelated', unrelated]])
    let attached = second
    const monaco = {
      Uri: { parse: (path: string) => path },
      editor: { getModel: (path: string) => models.get(path), getEditors: () => [{ getModel: () => attached }] },
    } as unknown as typeof Monaco
    const { result, rerender, unmount } = renderHook(({ paths }) => useMonacoModels(paths), { initialProps: { paths: ['one', 'two'] } })
    act(() => result.current(monaco))
    act(() => vi.runOnlyPendingTimers())
    expect(first.dispose).not.toHaveBeenCalled()
    rerender({ paths: ['one'] })
    expect(second.dispose).not.toHaveBeenCalled()
    attached = first
    act(() => vi.runOnlyPendingTimers())
    expect(second.dispose).toHaveBeenCalledOnce()
    expect(first.dispose).not.toHaveBeenCalled()
    unmount()
    attached = unrelated
    act(() => vi.runOnlyPendingTimers())
    expect(first.dispose).toHaveBeenCalledOnce()
    expect(unrelated.dispose).not.toHaveBeenCalled()
  })

  it('does not dispose retained models during StrictMode effect replay', () => {
    vi.useFakeTimers()
    const model = { dispose: vi.fn() }
    const monaco = { Uri: { parse: (path: string) => path }, editor: { getModel: () => model, getEditors: () => [] } } as unknown as typeof Monaco
    const { result } = renderHook(() => useMonacoModels(['one']), { wrapper: StrictMode })
    act(() => result.current(monaco))
    act(() => vi.runOnlyPendingTimers())
    expect(model.dispose).not.toHaveBeenCalled()
  })

  it('uses distinct model paths for documents and encodes user-controlled path segments', () => {
    expect(modelPath('json', 'one', 'input.json')).not.toBe(modelPath('json', 'two', 'input.json'))
    expect(modelPath('scratch', 'one/two', 'a?b#c')).toBe('inmemory://dev-tools/scratch/one%2Ftwo/a%3Fb%23c')
  })
})
