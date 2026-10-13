import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EditorLanguageTools, { type EditorLanguageBinding } from './EditorLanguageTools'
import type * as Monaco from 'monaco-editor'

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }))
vi.mock('./toastContext', () => ({ useToast: () => ({ showToast }) }))

const fixture = () => {
  let path = 'inmemory://dev-tools/scratch/a/pane'
  let markers: Partial<Monaco.editor.IMarker>[] = []
  const listeners = new Set<(resources: { toString: () => string }[]) => void>()
  let onChangeModel = () => {}
  const action = { isSupported: () => true, run: vi.fn().mockResolvedValue(undefined) }
  const disposable = { dispose: vi.fn() }
  const editor = {
    getModel: () => ({ uri: { toString: () => path }, isDisposed: () => false }),
    getAction: vi.fn(() => action), focus: vi.fn(), setPosition: vi.fn(), revealLineInCenter: vi.fn(),
    onDidChangeModel: (listener: () => void) => { onChangeModel = listener; return disposable },
    onDidChangeModelLanguage: () => disposable, onDidDispose: () => disposable,
  }
  const monaco = {
    MarkerSeverity: { Error: 8, Warning: 4 },
    editor: {
      getModelMarkers: vi.fn(() => markers),
      onDidChangeMarkers: (listener: (resources: { toString: () => string }[]) => void) => {
        listeners.add(listener)
        return { dispose: () => listeners.delete(listener) }
      },
    },
  }
  return {
    binding: { editor, monaco } as unknown as EditorLanguageBinding, editor, action, disposable, listeners,
    setMarkers: (next: Partial<Monaco.editor.IMarker>[], changedPath = path) => {
      markers = next
      listeners.forEach((listener) => listener([{ toString: () => changedPath }]))
    },
    switchModel: (nextPath: string) => { path = nextPath; onChangeModel() },
  }
}
const marker = (severity = 8) => ({ severity, message: '类型不匹配', startLineNumber: 3, startColumn: 7 })

describe('editor language tools', () => {
  it('updates only current-model diagnostics, locates a problem, and releases subscriptions', () => {
    const f = fixture()
    const { unmount } = render(<EditorLanguageTools binding={f.binding} path="inmemory://dev-tools/scratch/a/pane" language="typescript" label="栏 1" />)
    act(() => { f.setMarkers([marker()], 'inmemory://other') })
    expect(screen.getByRole('button', { name: '栏 1问题 0' })).toBeInTheDocument()
    act(() => { f.setMarkers([marker(), marker(2)]) })
    fireEvent.click(screen.getByRole('button', { name: '栏 1问题 1' }))
    fireEvent.click(screen.getByText('类型不匹配'))
    expect(f.editor.setPosition).toHaveBeenCalledWith({ lineNumber: 3, column: 7 })
    expect(f.editor.revealLineInCenter).toHaveBeenCalledWith(3)
    expect(f.editor.focus).toHaveBeenCalled()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    unmount()
    expect(f.listeners.size).toBe(0)
    expect(f.disposable.dispose).toHaveBeenCalledTimes(3)
  })
  it('clears old diagnostics on document/language changes and hides unsupported tools', () => {
    const f = fixture()
    const { rerender } = render(<EditorLanguageTools binding={f.binding} path="inmemory://dev-tools/scratch/a/pane" language="typescript" label="栏 1" />)
    act(() => { f.setMarkers([marker()]) })
    fireEvent.click(screen.getByRole('button', { name: '栏 1问题 1' }))
    act(() => { f.switchModel('inmemory://dev-tools/scratch/b/pane') })
    expect(screen.getByRole('button', { name: '栏 1问题 0' })).toBeInTheDocument()
    rerender(<EditorLanguageTools binding={f.binding} path="inmemory://dev-tools/scratch/b/pane" language="html" label="栏 1" />)
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /问题/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '栏 1格式化' })).toBeInTheDocument()
    rerender(<EditorLanguageTools binding={f.binding} path="inmemory://dev-tools/scratch/b/pane" language="go" label="栏 1" />)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })
  it('runs completion/formatting on the focused editor and rejects obsolete bindings', async () => {
    const f = fixture()
    render(<EditorLanguageTools binding={f.binding} path="inmemory://dev-tools/scratch/a/pane" language="javascript" label="栏 1" />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '栏 1补全' })) })
    expect(f.editor.getAction).toHaveBeenCalledWith('editor.action.triggerSuggest')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '栏 1格式化' })) })
    expect(f.editor.getAction).toHaveBeenCalledWith('editor.action.formatDocument')
    expect(f.action.run).toHaveBeenCalledTimes(2)
    act(() => { f.switchModel('inmemory://other') })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '栏 1格式化' })) })
    expect(f.action.run).toHaveBeenCalledTimes(2)
    expect(showToast).toHaveBeenCalledWith('语言服务尚未就绪，请稍后重试', 'info')
  })
})
