import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('JsonFormatter', () => {
  it('格式化和压缩保留大整数和高精度小数', () => {
    renderJsonFormatter()
    const source = '{"id":9007199254740993,"decimal":0.123456789012345678901}'
    fireEvent.change(screen.getByLabelText('input-editor'), { target: { value: source } })
    expect(screen.getByLabelText('output-editor')).toHaveValue('{\n  "id": 9007199254740993,\n  "decimal": 0.123456789012345678901\n}')
    fireEvent.click(screen.getByRole('button', { name: '压缩' }))
    expect(screen.getByLabelText('output-editor')).toHaveValue(source)
  })

  it('恢复处理期间保存的草稿时补齐预览', () => {
    localStorage.setItem('dev-tools:json-formatter:draft', JSON.stringify({
      value: { activeDocumentId: 'pending', indentSize: 2, documents: [{
        id: 'pending', name: 'JSON 1', input: '{"id":9007199254740993}', output: '', error: '', splitRatio: 30,
      }] }, expiresAt: Date.now() + 60_000,
    }))
    renderJsonFormatter()
    expect(screen.getByLabelText('output-editor')).toHaveValue('{\n  "id": 9007199254740993\n}')
  })

  it('Schema 按文档保存，拒绝无效规则并可移除', () => {
    renderJsonFormatter()
    fireEvent.click(screen.getByRole('button', { name: 'Schema' }))
    const schema = screen.getByLabelText('当前文档的校验规则')
    fireEvent.change(schema, { target: { value: '[]' } })
    fireEvent.click(screen.getByRole('button', { name: '应用' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Schema 必须是 JSON 对象或布尔值')
    const source = '{"type":"object","required":["name"]}'
    fireEvent.change(schema, { target: { value: source } })
    fireEvent.click(screen.getByRole('button', { name: '应用' }))
    expect(screen.getByRole('button', { name: 'Schema · 已启用' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '新建 JSON' }))
    expect(screen.getByRole('button', { name: 'Schema' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'JSON 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Schema · 已启用' }))
    expect(screen.getByLabelText('当前文档的校验规则')).toHaveValue(source)
    fireEvent.change(screen.getByLabelText('当前文档的校验规则'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: '应用' }))
    expect(screen.getByRole('button', { name: 'Schema' })).toBeInTheDocument()
  })
  it('保存当前标签的输出，支持自定义文件名及输出全屏', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:json-download')
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
    const filenames: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      filenames.push(this.download)
    })
    renderJsonFormatter()
    expect(screen.getByRole('button', { name: '保存到文件' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('input-editor'), { target: { value: '{"first":1}' } })
    fireEvent.click(screen.getByRole('button', { name: '新建 JSON' }))
    fireEvent.change(screen.getByLabelText('input-editor'), { target: { value: '{"第二个":"中文😀"}' } })
    fireEvent.click(screen.getByRole('button', { name: '压缩' }))
    fireEvent.click(screen.getByTitle('全屏查看'))
    fireEvent.click(screen.getByRole('button', { name: '保存到文件' }))
    expect(screen.getByLabelText('文件名')).toHaveValue('JSON 2.json')
    fireEvent.change(screen.getByLabelText('文件名'), { target: { value: '测试结果.json' } })
    fireEvent.click(screen.getByRole('button', { name: /^保存$/ }))
    expect(filenames).toEqual(['测试结果.json'])
    const blob = createObjectURL.mock.calls[0][0]
    expect(await blob.text()).toBe('{"第二个":"中文😀"}')
    expect(blob.type).toBe('application/json;charset=utf-8')
    fireEvent.click(screen.getByTitle('退出全屏'))
    fireEvent.click(screen.getByRole('tab', { name: 'JSON 1' }))
    fireEvent.click(screen.getByRole('button', { name: '保存到文件' }))
    fireEvent.click(screen.getByRole('button', { name: /^保存$/ }))
    expect(await createObjectURL.mock.calls[1][0].text()).toBe('{\n  "first": 1\n}')
    expect(filenames[1]).toBe('JSON 1.json')
  })

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

  it('可以新增并切换多个 JSON，且每个 JSON 的内容独立保留', () => {
    renderJsonFormatter()

    const input = screen.getByLabelText('input-editor')
    fireEvent.change(input, { target: { value: '{"first":1}' } })

    fireEvent.click(screen.getByRole('button', { name: '新建 JSON' }))
    expect(screen.getByRole('tab', { name: 'JSON 2' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.change(screen.getByLabelText('input-editor'), { target: { value: '{"second":2}' } })
    fireEvent.click(screen.getByRole('tab', { name: 'JSON 1' }))

    expect(screen.getByLabelText('input-editor')).toHaveValue('{"first":1}')
    expect(screen.getByLabelText('output-editor')).toHaveValue('{\n  "first": 1\n}')

    fireEvent.click(screen.getByRole('tab', { name: 'JSON 2' }))
    expect(screen.getByLabelText('input-editor')).toHaveValue('{"second":2}')
    expect(screen.getByLabelText('output-editor')).toHaveValue('{\n  "second": 2\n}')
  })

  it('关闭当前 JSON 后应切换到保留的 JSON', () => {
    renderJsonFormatter()

    fireEvent.change(screen.getByLabelText('input-editor'), { target: { value: '{"first":1}' } })
    fireEvent.click(screen.getByRole('button', { name: '新建 JSON' }))
    fireEvent.change(screen.getByLabelText('input-editor'), { target: { value: '{"second":2}' } })
    fireEvent.click(screen.getByRole('button', { name: '关闭 JSON 2' }))

    expect(screen.queryByRole('tab', { name: 'JSON 2' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'JSON 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('input-editor')).toHaveValue('{"first":1}')
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

  it('输入侧全屏应在浏览器标签页内同时展示输入和输出双栏', () => {
    renderJsonFormatter()

    const editorContainer = screen.getByTestId('json-editor-container')
    const tool = editorContainer.closest('.json-formatter')
    fireEvent.click(screen.getByTitle('输入输出全屏'))

    expect(tool).toHaveClass('fullscreen-mode')
    expect(editorContainer).toHaveClass('dual-fullscreen-container')
    expect(screen.getByLabelText('input-editor')).toBeInTheDocument()
    expect(screen.getByLabelText('output-editor')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(tool).not.toHaveClass('fullscreen-mode')
    expect(editorContainer).not.toHaveClass('dual-fullscreen-container')
  })

  it('输出侧全屏应在浏览器标签页内仅展示输出', () => {
    renderJsonFormatter()

    const editorContainer = screen.getByTestId('json-editor-container')
    const tool = editorContainer.closest('.json-formatter')
    fireEvent.click(screen.getByTitle('全屏查看'))

    expect(tool).toHaveClass('fullscreen-mode')
    expect(editorContainer).toHaveClass('fullscreen-container')
    expect(screen.queryByLabelText('input-editor')).not.toBeInTheDocument()
    expect(screen.getByLabelText('output-editor')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('退出全屏'))

    expect(tool).not.toHaveClass('fullscreen-mode')
    expect(screen.getByLabelText('input-editor')).toBeInTheDocument()
  })

  it('重新挂载后应恢复两天内保存的多个 JSON', () => {
    const { unmount } = renderJsonFormatter()

    const input = screen.getByLabelText('input-editor')
    fireEvent.change(input, { target: { value: '{"name":"tool"}' } })
    fireEvent.click(screen.getByRole('button', { name: '新建 JSON' }))
    fireEvent.change(screen.getByLabelText('input-editor'), { target: { value: '{"name":"second"}' } })
    unmount()

    renderJsonFormatter()

    expect(screen.getByRole('tab', { name: 'JSON 2' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('input-editor')).toHaveValue('{"name":"second"}')
    fireEvent.click(screen.getByRole('tab', { name: 'JSON 1' }))
    expect(screen.getByLabelText('input-editor')).toHaveValue('{"name":"tool"}')
    expect(screen.getByLabelText('output-editor')).toHaveValue('{\n  "name": "tool"\n}')
  })

  it('应为每个 JSON 独立保存输入输出分割比例', () => {
    const { unmount } = renderJsonFormatter()

    const firstSplitter = screen.getByRole('separator', { name: '调整输入输出宽度' })
    expect(firstSplitter).toHaveAttribute('aria-valuenow', '30')
    fireEvent.keyDown(firstSplitter, { key: 'ArrowRight' })
    expect(firstSplitter).toHaveAttribute('aria-valuenow', '32')

    fireEvent.click(screen.getByRole('button', { name: '新建 JSON' }))
    const secondSplitter = screen.getByRole('separator', { name: '调整输入输出宽度' })
    expect(secondSplitter).toHaveAttribute('aria-valuenow', '30')
    fireEvent.keyDown(secondSplitter, { key: 'ArrowLeft' })
    expect(secondSplitter).toHaveAttribute('aria-valuenow', '28')

    fireEvent.click(screen.getByRole('tab', { name: 'JSON 1' }))
    expect(screen.getByRole('separator', { name: '调整输入输出宽度' })).toHaveAttribute('aria-valuenow', '32')

    unmount()
    renderJsonFormatter()

    expect(screen.getByRole('tab', { name: 'JSON 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('separator', { name: '调整输入输出宽度' })).toHaveAttribute('aria-valuenow', '32')
    fireEvent.click(screen.getByRole('tab', { name: 'JSON 2' }))
    expect(screen.getByRole('separator', { name: '调整输入输出宽度' })).toHaveAttribute('aria-valuenow', '28')
  })

  it('拖动分割线应按容器宽度调整并限制比例范围', () => {
    renderJsonFormatter()

    const container = screen.getByTestId('json-editor-container')
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 1100,
      bottom: 600,
      width: 1000,
      height: 600,
      toJSON: () => ({}),
    })
    const splitter = screen.getByRole('separator', { name: '调整输入输出宽度' })
    splitter.setPointerCapture = vi.fn()
    splitter.hasPointerCapture = vi.fn(() => true)
    splitter.releasePointerCapture = vi.fn()

    fireEvent.pointerDown(splitter, { button: 0, pointerId: 1, clientX: 600 })
    expect(splitter).toHaveAttribute('aria-valuenow', '50')

    fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 1050 })
    expect(splitter).toHaveAttribute('aria-valuenow', '80')

    fireEvent.pointerUp(splitter, { pointerId: 1 })
    fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 300 })
    expect(splitter).toHaveAttribute('aria-valuenow', '80')
  })

  it('应兼容恢复旧版单组 JSON 草稿', () => {
    localStorage.setItem('dev-tools:json-formatter:draft', JSON.stringify({
      value: {
        input: '{"legacy":true}',
        output: '{\n  "legacy": true\n}',
        indentSize: 2,
      },
      expiresAt: Date.now() + 1_000,
    }))

    renderJsonFormatter()

    expect(screen.getByLabelText('input-editor')).toHaveValue('{"legacy":true}')
    expect(screen.getByLabelText('output-editor')).toHaveValue('{\n  "legacy": true\n}')
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
