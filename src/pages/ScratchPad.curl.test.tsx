import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScratchPad from './ScratchPad'
import { ToastProvider } from '../components/Toast'

const { editors } = vi.hoisted(() => ({
  editors: new Map<string, { undo: () => void; pushUndoStop: ReturnType<typeof vi.fn> }>(),
}))

vi.mock('../components/EditorLanguageTools', () => ({ default: () => null }))
vi.mock('@monaco-editor/react', async () => {
  const { useEffect, useRef } = await import('react')
  return { default: function MockEditor(props: {
    value: string; path: string; onChange: (value: string) => void
    onMount: (editor: unknown, monaco: unknown) => void
  }) {
    const latest = useRef(props)
    latest.current = props
    useEffect(() => {
      const undo: string[] = []
      const pushUndoStop = vi.fn()
      const model = {
        uri: { toString: () => props.path }, isDisposed: () => false,
        getFullModelRange: () => ({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }),
      }
      const editor = {
        getModel: () => model, getValue: () => latest.current.value, pushUndoStop, focus: vi.fn(),
        executeEdits: (_source: string, edits: { text: string }[]) => {
          undo.push(latest.current.value)
          latest.current.onChange(edits[0].text)
          return true
        },
      }
      latest.current.onMount(editor, { Uri: { parse: (path: string) => path }, editor: { getModel: () => null } })
      editors.set(props.path, { pushUndoStop, undo: () => latest.current.onChange(undo.pop() ?? '') })
      return () => { editors.delete(props.path) }
    }, [props.path])
    return <textarea aria-label={props.path} value={props.value} onChange={event => props.onChange(event.target.value)} />
  } }
})

beforeEach(() => { localStorage.clear(); editors.clear(); vi.useFakeTimers() })
afterEach(() => vi.useRealTimers())
const mount = () => render(<ToastProvider><ScratchPad /></ToastProvider>)
const command = `curl https://example.com -H 'X-Test: a b' --future-option=value --data '{"n":12345678901234567890}'`

describe('ScratchPad curl formatting', () => {
  it('shows formatting directly after copy only for curl, and preserves manual language selection', () => {
    mount()
    expect(screen.queryByRole('button', { name: '栏 1格式化 curl' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'echo hello' } })
    expect(screen.queryByRole('button', { name: '栏 1格式化 curl' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: command } })
    const button = screen.getByRole('button', { name: '栏 1格式化 curl' })
    expect(button.previousElementSibling).toHaveTextContent('复制')
    fireEvent.change(screen.getByRole('combobox', { name: '栏 1 语言' }), { target: { value: 'plaintext' } })
    fireEvent.click(button)
    expect(screen.getByRole('textbox')).toHaveValue(command.replace(' -H', ' \\\n  -H').replace(' --future', ' \\\n  --future').replace(' --data', ' \\\n  --data'))
    expect(screen.getByRole('combobox', { name: '栏 1 语言' })).toHaveValue('plaintext')
    expect([...editors.values()][0].pushUndoStop).toHaveBeenCalledTimes(2)
    fireEvent.click(button)
    expect([...editors.values()][0].pushUndoStop).toHaveBeenCalledTimes(2)
    act(() => [...editors.values()][0].undo())
    expect(screen.getByRole('textbox')).toHaveValue(command)
  })

  it('formats only its own pane in fullscreen and persists the result across tabs and remounts', () => {
    const view = mount()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: command } })
    fireEvent.click(screen.getByRole('button', { name: /分栏/ }))
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[1], { target: { value: command } })
    fireEvent.click(screen.getByRole('button', { name: '⛶ 全屏' }))
    fireEvent.click(screen.getByRole('button', { name: '栏 2格式化 curl' }))
    expect(inputs[0]).toHaveValue(command)
    expect(inputs[1]).not.toHaveValue(command)
    const formatted = (inputs[1] as HTMLTextAreaElement).value
    fireEvent.click(screen.getByRole('button', { name: '⤓ 退出全屏' }))
    fireEvent.click(screen.getByRole('button', { name: '新建文本' }))
    fireEvent.click(screen.getByRole('tab', { name: '文本 1' }))
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getAllByRole('textbox')[1]).toHaveValue(formatted)
    view.unmount()
    mount()
    expect(screen.getAllByRole('textbox')[1]).toHaveValue(formatted)
  })

  it('reports malformed or unsupported syntax without modifying the pane', () => {
    mount()
    const input = screen.getByRole('textbox')
    for (const value of ["curl --data 'broken", 'curl https://example.com | cat']) {
      fireEvent.change(input, { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: '栏 1格式化 curl' }))
      expect(input).toHaveValue(value)
      expect([...editors.values()][0].pushUndoStop).not.toHaveBeenCalled()
    }
    expect(within(document.querySelector('.toast-container') as HTMLElement).getAllByText(/已保留原文/)).toHaveLength(2)
  })
})
