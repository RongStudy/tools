import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import JsonFormatter from './JsonFormatter'
import { ToastProvider } from '../components/Toast'

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, options }: {
    value: string
    onChange?: (value: string) => void
    options?: { readOnly?: boolean }
  }) => (
    <textarea
      aria-label={options?.readOnly ? 'output-editor' : 'input-editor'}
      value={value}
      readOnly={options?.readOnly}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}))

function renderJsonFormatter() {
  return render(
    <ToastProvider>
      <JsonFormatter />
    </ToastProvider>
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('JsonFormatter', () => {
  it('解析失败时应清空旧输出，避免展示过期结果', () => {
    renderJsonFormatter()

    const input = screen.getByLabelText('input-editor')
    const output = screen.getByLabelText('output-editor') as HTMLTextAreaElement

    fireEvent.change(input, { target: { value: '{"name":"tool"}' } })
    expect(output.value).toBe('{\n  "name": "tool"\n}')

    fireEvent.change(input, { target: { value: '{"name":' } })
    expect(output.value).toBe('')
    expect(screen.getByText(/格式错误/)).toBeInTheDocument()
  })

  it('切换缩进大小时应立即用新缩进刷新输出', () => {
    renderJsonFormatter()

    const input = screen.getByLabelText('input-editor')
    const output = screen.getByLabelText('output-editor') as HTMLTextAreaElement
    const indentSelect = screen.getByRole('combobox')

    fireEvent.change(input, { target: { value: '{"outer":{"inner":1}}' } })
    fireEvent.change(indentSelect, { target: { value: '4' } })

    expect(output.value).toBe('{\n    "outer": {\n        "inner": 1\n    }\n}')
  })

  it('Clipboard API 不可用时应显示复制失败而不是抛出异常', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })

    renderJsonFormatter()

    const input = screen.getByLabelText('input-editor')
    fireEvent.change(input, { target: { value: '{"name":"tool"}' } })

    fireEvent.click(screen.getAllByText('复制')[0])

    await waitFor(() => {
      expect(screen.getByText('复制失败')).toBeInTheDocument()
    })
  })

  it('输入侧全屏应同时展示输入和输出双栏', async () => {
    let fullscreenElement: Element | null = null
    const requestFullscreen = vi.fn(() => {
      fullscreenElement = screen.getByTestId('json-editor-container')
      document.dispatchEvent(new Event('fullscreenchange'))
      return Promise.resolve()
    })
    const exitFullscreen = vi.fn(() => {
      fullscreenElement = null
      document.dispatchEvent(new Event('fullscreenchange'))
      return Promise.resolve()
    })

    Object.defineProperty(document, 'fullscreenElement', {
      get: () => fullscreenElement,
      configurable: true,
    })
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      value: requestFullscreen,
      configurable: true,
    })
    Object.defineProperty(document, 'exitFullscreen', {
      value: exitFullscreen,
      configurable: true,
    })

    renderJsonFormatter()

    fireEvent.click(screen.getByTitle('输入输出全屏'))

    await waitFor(() => {
      expect(screen.getByTestId('json-editor-container')).toHaveClass('dual-fullscreen-container')
    })
    expect(screen.getByLabelText('input-editor')).toBeInTheDocument()
    expect(screen.getByLabelText('output-editor')).toBeInTheDocument()
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
  })

  it('重新挂载后应恢复两天内保存的输入和输出内容', () => {
    const { unmount } = renderJsonFormatter()

    const input = screen.getByLabelText('input-editor')
    fireEvent.change(input, { target: { value: '{"name":"tool"}' } })
    unmount()

    renderJsonFormatter()

    expect(screen.getByLabelText('input-editor')).toHaveValue('{"name":"tool"}')
    expect(screen.getByLabelText('output-editor')).toHaveValue('{\n  "name": "tool"\n}')
  })

  it('超过两天的保存内容应过期失效', () => {
    localStorage.setItem('dev-tools:json-formatter:draft', JSON.stringify({
      value: {
        input: '{"expired":true}',
        output: '{\n  "expired": true\n}',
        indentSize: 2,
      },
      expiresAt: Date.now() - 1,
    }))

    renderJsonFormatter()

    expect(screen.getByLabelText('input-editor')).toHaveValue('')
    expect(screen.getByLabelText('output-editor')).toHaveValue('')
  })
})
