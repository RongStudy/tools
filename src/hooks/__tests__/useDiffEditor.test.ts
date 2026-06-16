import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDiffEditor } from '../useDiffEditor'
import type { MonacoDiffEditor } from '../../types/monaco'

function createDisposable() {
  return { dispose: vi.fn() }
}

function createCodeEditor() {
  return {
    updateOptions: vi.fn(),
    getModel: vi.fn(() => ({})),
    onDidChangeModelContent: vi.fn(() => createDisposable()),
    onDidFocusEditorText: vi.fn(() => createDisposable()),
    getValue: vi.fn(() => ''),
    getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
    setPosition: vi.fn(),
    revealLineInCenter: vi.fn(),
  }
}

describe('useDiffEditor', () => {
  it('应在 Monaco diff 更新后刷新差异数量', () => {
    let diffChanges = [
      {
        originalStartLineNumber: 1,
        originalEndLineNumber: 1,
        modifiedStartLineNumber: 1,
        modifiedEndLineNumber: 1,
        charChanges: null,
      },
    ]
    let onDidUpdateDiff: (() => void) | null = null
    const originalEditor = createCodeEditor()
    const modifiedEditor = createCodeEditor()
    const diffEditor = {
      getOriginalEditor: vi.fn(() => originalEditor),
      getModifiedEditor: vi.fn(() => modifiedEditor),
      getLineChanges: vi.fn(() => diffChanges),
      onDidUpdateDiff: vi.fn((callback: () => void) => {
        onDidUpdateDiff = callback
        return createDisposable()
      }),
    } as unknown as MonacoDiffEditor

    const { result } = renderHook(() => useDiffEditor())

    act(() => {
      result.current.handleEditorMount(diffEditor, {})
    })

    expect(result.current.getDiffCount()).toBe(1)

    diffChanges = [
      ...diffChanges,
      {
        originalStartLineNumber: 3,
        originalEndLineNumber: 3,
        modifiedStartLineNumber: 3,
        modifiedEndLineNumber: 3,
        charChanges: null,
      },
    ]

    act(() => {
      onDidUpdateDiff?.()
    })

    expect(result.current.getDiffCount()).toBe(2)
  })

  it('应同时给左右内部编辑器开启自动换行', () => {
    const originalEditor = createCodeEditor()
    const modifiedEditor = createCodeEditor()
    const diffEditor = {
      getOriginalEditor: vi.fn(() => originalEditor),
      getModifiedEditor: vi.fn(() => modifiedEditor),
      getLineChanges: vi.fn(() => []),
      onDidUpdateDiff: vi.fn(() => createDisposable()),
    } as unknown as MonacoDiffEditor

    const { result } = renderHook(() => useDiffEditor())

    act(() => {
      result.current.handleEditorMount(diffEditor, {})
    })

    expect(originalEditor.updateOptions).toHaveBeenCalledWith(expect.objectContaining({
      readOnly: false,
      wordWrap: 'on',
      wrappingIndent: 'same',
    }))
    expect(modifiedEditor.updateOptions).toHaveBeenCalledWith(expect.objectContaining({
      readOnly: false,
      wordWrap: 'on',
      wrappingIndent: 'same',
    }))
  })

  it('DiffEditor 不重建时应使用最新的内容变化回调', () => {
    let originalValue = 'first'
    let originalListener: (() => void) | null = null
    const originalEditor = {
      ...createCodeEditor(),
      getValue: vi.fn(() => originalValue),
      onDidChangeModelContent: vi.fn((callback: () => void) => {
        originalListener = callback
        return createDisposable()
      }),
    }
    const modifiedEditor = createCodeEditor()
    const diffEditor = {
      getOriginalEditor: vi.fn(() => originalEditor),
      getModifiedEditor: vi.fn(() => modifiedEditor),
      getLineChanges: vi.fn(() => []),
      onDidUpdateDiff: vi.fn(() => createDisposable()),
    } as unknown as MonacoDiffEditor
    const staleOriginalChange = vi.fn()
    const latestOriginalChange = vi.fn()

    const { result } = renderHook(() => useDiffEditor())

    act(() => {
      result.current.handleEditorMount(diffEditor, {
        onOriginalChange: staleOriginalChange,
      })
    })
    act(() => {
      result.current.setEditorCallbacks({
        onOriginalChange: latestOriginalChange,
      })
    })

    originalValue = 'latest'
    act(() => {
      originalListener?.()
    })

    expect(staleOriginalChange).not.toHaveBeenCalled()
    expect(latestOriginalChange).toHaveBeenCalledWith('latest')
  })

  it('应根据左右非内容区宽度修正默认分栏比例，让内容区等宽', () => {
    const originalEditor = {
      ...createCodeEditor(),
      getLayoutInfo: vi.fn(() => ({
        width: 500,
        contentWidth: 430,
      })),
    }
    const modifiedEditor = {
      ...createCodeEditor(),
      getLayoutInfo: vi.fn(() => ({
        width: 500,
        contentWidth: 450,
      })),
    }
    const updateOptions = vi.fn()
    const diffEditor = {
      getOriginalEditor: vi.fn(() => originalEditor),
      getModifiedEditor: vi.fn(() => modifiedEditor),
      getLineChanges: vi.fn(() => []),
      getContainerDomNode: vi.fn(() => ({
        getBoundingClientRect: () => ({ width: 1000 }),
      })),
      updateOptions,
      layout: vi.fn(),
      onDidUpdateDiff: vi.fn(() => createDisposable()),
    } as unknown as MonacoDiffEditor

    const { result } = renderHook(() => useDiffEditor())

    act(() => {
      result.current.handleEditorMount(diffEditor, {})
    })

    expect(updateOptions).toHaveBeenCalledWith(expect.objectContaining({
      splitViewDefaultRatio: 0.51,
    }))
  })
})
