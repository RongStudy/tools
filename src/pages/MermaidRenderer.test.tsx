import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorProps } from '@monaco-editor/react'
import { ToastProvider } from '../components/Toast'
import { ThemeProvider } from '../theme'
import { useAppTheme } from '../themeContext'
import MermaidRenderer, { DEFAULT_MERMAID_CODE } from './MermaidRenderer'

const { mermaidRenderMock, setMarkersMock, renderCommands } = vi.hoisted(() => ({
  mermaidRenderMock: vi.fn(),
  setMarkersMock: vi.fn(),
  renderCommands: [] as Array<() => void>,
}))

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: mermaidRenderMock,
  },
}))

vi.mock('@monaco-editor/react', async () => {
  const { useEffect, useRef } = await import('react')
  const MockEditor = ({ value, onChange, onMount, language, theme }: {
    value?: string
    language?: string
    theme?: string
    onChange?: (value: string | undefined) => void
    onMount?: EditorProps['onMount']
  }) => {
    const source = useRef(value)
    source.current = value
    const mount = useRef(onMount)
    useEffect(() => {
      const model = {
        getLineCount: () => (source.current ?? '').split('\n').length,
        getLineMaxColumn: (line: number) => ((source.current ?? '').split('\n')[line - 1]?.length ?? 0) + 1,
      }
      mount.current?.({
        getModel: () => model,
        getValue: () => source.current ?? '',
        addCommand: (_key: number, command: () => void) => { renderCommands.push(command) },
      } as unknown as Parameters<NonNullable<EditorProps['onMount']>>[0], {
        KeyMod: { CtrlCmd: 1 }, KeyCode: { Enter: 2 }, MarkerSeverity: { Error: 8 },
        editor: { setModelMarkers: setMarkersMock },
      } as unknown as Parameters<NonNullable<EditorProps['onMount']>>[1])
    }, [])
    return (
      <textarea
        aria-label="内容编辑器"
        data-language={language}
        data-theme={theme}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    )
  }
  return { default: MockEditor }
})

describe('MermaidRenderer', () => {
  beforeEach(() => {
    localStorage.clear()
    mermaidRenderMock.mockReset()
    setMarkersMock.mockClear()
    renderCommands.length = 0
    mermaidRenderMock.mockResolvedValue({
      svg: '<svg viewBox="0 0 120 60"><text>diagram</text></svg>',
    })
  })

  it('switches Monaco and Mermaid themes without replacing the editor', async () => {
    const ThemeToggle = () => {
      const { toggleTheme } = useAppTheme()
      return <button onClick={toggleTheme}>切换主题</button>
    }
    render(<ThemeProvider><ToastProvider><ThemeToggle /><MermaidRenderer /></ToastProvider></ThemeProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    const editor = screen.getByLabelText('内容编辑器')
    expect(editor).toHaveAttribute('data-theme', 'vs-dark')

    fireEvent.click(screen.getByRole('button', { name: '切换主题' }))
    await waitFor(() => expect(editor).toHaveAttribute('data-theme', 'vs'))
    await waitFor(() => expect(mermaidRenderMock).toHaveBeenCalledTimes(2))
    expect(editor).toBe(screen.getByLabelText('内容编辑器'))
  })

  it('默认示例会自动渲染为图表', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)

    await waitFor(() => {
      expect(mermaidRenderMock).toHaveBeenCalledWith(
        expect.stringMatching(/^mermaid-diagram-/),
        DEFAULT_MERMAID_CODE
      )
    })

    expect(await screen.findByRole('img', { name: 'Mermaid 图表预览' })).toHaveTextContent('diagram')
    expect(screen.getByRole('status')).toHaveTextContent('已渲染')
  })

  it('修改代码后会实时重新渲染', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    mermaidRenderMock.mockClear()

    fireEvent.change(screen.getByLabelText('内容编辑器'), {
      target: { value: 'sequenceDiagram\n  A->>B: Hello' },
    })

    await waitFor(() => {
      expect(mermaidRenderMock).toHaveBeenCalledWith(
        expect.stringMatching(/^mermaid-diagram-/),
        'sequenceDiagram\n  A->>B: Hello'
      )
    })
  })

  it('语法错误时保留工作区尺寸并显示错误', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    mermaidRenderMock.mockRejectedValueOnce(new Error('Parse error on line 2'))

    fireEvent.change(screen.getByLabelText('内容编辑器'), {
      target: { value: 'flowchart ???' },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Parse error on line 2')
    expect(screen.queryByRole('img', { name: 'Mermaid 图表预览' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('语法错误')
  })

  it('自动识别 Markdown 内容并渲染', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })

    fireEvent.change(screen.getByLabelText('内容编辑器'), {
      target: { value: '# 标题\n\n- 项目一\n- 项目二' },
    })

    const preview = await screen.findByTestId('markdown-preview')
    expect(preview.querySelector('h1')).toHaveTextContent('标题')
    expect(preview.querySelectorAll('li')).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveTextContent('已渲染')
  })

  it('退出全屏后为重新挂载的模型恢复错误标记，切到 Markdown 后清除', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    mermaidRenderMock.mockRejectedValue(new Error('Parse error on line 2'))
    fireEvent.change(screen.getByLabelText('内容编辑器'), {
      target: { value: 'flowchart LR\n A[broken' },
    })
    await screen.findByRole('alert')
    const firstModel = setMarkersMock.mock.lastCall?.[0]
    expect(setMarkersMock.mock.lastCall?.[2]).toEqual([expect.objectContaining({ startLineNumber: 2, severity: 8 })])
    fireEvent.click(screen.getByRole('button', { name: /全屏/ }))
    setMarkersMock.mockClear()
    fireEvent.click(screen.getByRole('button', { name: /退出全屏/ }))
    await waitFor(() => expect(setMarkersMock.mock.lastCall?.[2]).toEqual([
      expect.objectContaining({ startLineNumber: 2, message: 'Parse error on line 2' }),
    ]))
    expect(setMarkersMock.mock.lastCall?.[0]).not.toBe(firstModel)
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))
    await screen.findByTestId('markdown-preview')
    expect(setMarkersMock.mock.lastCall?.[2]).toEqual([])
  })

  it('渲染快捷键使用最新模式并同步编辑器语言', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))
    fireEvent.change(screen.getByLabelText('内容编辑器'), { target: { value: '# 快捷键' } })
    mermaidRenderMock.mockClear()
    await act(async () => { renderCommands[0]() })
    expect(screen.getByTestId('markdown-preview')).toHaveTextContent('快捷键')
    expect(screen.getByLabelText('内容编辑器')).toHaveAttribute('data-language', 'markdown')
    expect(mermaidRenderMock).not.toHaveBeenCalled()
  })

  it('支持 LaTeX 数学公式（行内与块级）', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })

    fireEvent.change(screen.getByLabelText('内容编辑器'), {
      target: { value: '公式：$E = mc^2$\n\n$$\n\\int_0^1 x\\,dx\n$$' },
    })

    const preview = await screen.findByTestId('markdown-preview')
    expect(preview.querySelector('.katex')).not.toBeNull()
  })

  it('支持 GFM 表格与任务列表', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })

    fireEvent.change(screen.getByLabelText('内容编辑器'), {
      target: { value: '| a | b |\n| --- | --- |\n| 1 | 2 |\n\n- [x] 完成' },
    })

    const preview = await screen.findByTestId('markdown-preview')
    expect(preview.querySelector('table')).not.toBeNull()
    expect(preview.querySelector('input[type="checkbox"]')).not.toBeNull()
  })

  it('可以手动切换渲染格式', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })

    // 强制 Markdown 模式
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Markdown' })).toHaveAttribute('aria-pressed', 'true')
    })

    fireEvent.change(screen.getByLabelText('内容编辑器'), {
      target: { value: 'Hello **world**' },
    })
    const preview = await screen.findByTestId('markdown-preview')
    expect(preview.querySelector('strong')).toHaveTextContent('world')

    // 切回自动模式 → 内容首行非 Mermaid 关键字，仍按 Markdown 渲染
    fireEvent.click(screen.getByRole('button', { name: '自动' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '自动' })).toHaveAttribute('aria-pressed', 'true')
    })
    await waitFor(() => {
      expect(screen.getByTestId('markdown-preview')).not.toBeNull()
    })
  })

  it('Markdown 预览默认铺满显示，可切换为居中', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })

    fireEvent.change(screen.getByLabelText('内容编辑器'), {
      target: { value: '# 布局测试' },
    })

    const preview = await screen.findByTestId('markdown-preview')
    expect(preview).toHaveClass('layout-full')
    expect(preview).not.toHaveClass('layout-centered')
    expect(screen.getByRole('button', { name: '铺满' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: '居中' }))
    expect(preview).toHaveClass('layout-centered')
    expect(screen.getByRole('button', { name: '居中' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: '铺满' }))
    expect(preview).toHaveClass('layout-full')
  })

  it('Markdown 模式导出 HTML 与当前显示布局一致', async () => {
    let capturedBlob: Blob | null = null
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (blob: Blob) => {
        capturedBlob = blob
        return 'blob:mock'
      },
      revokeObjectURL,
    })
    const clickSpy = vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => undefined)

    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })

    fireEvent.change(screen.getByLabelText('内容编辑器'), {
      target: { value: '# 导出测试' },
    })
    await screen.findByTestId('markdown-preview')

    // 默认铺满布局 → 导出 HTML 铺满样式
    fireEvent.click(screen.getByRole('button', { name: 'HTML' }))
    expect(clickSpy).toHaveBeenCalled()
    let text = await capturedBlob!.text()
    expect(text).toContain('max-width:none')
    expect(text).toContain('<h1>导出测试</h1>')

    // 切换为居中 → 导出 HTML 居中样式
    fireEvent.click(screen.getByRole('button', { name: '居中' }))
    fireEvent.click(screen.getByRole('button', { name: 'HTML' }))
    text = await capturedBlob!.text()
    expect(text).toContain('max-width:52rem')
    expect(text).toContain('margin:0 auto')

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('Markdown 中的 mermaid 代码块渲染为图表', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })

    fireEvent.change(screen.getByLabelText('内容编辑器'), {
      target: { value: '# 架构\n\n```mermaid\nflowchart LR\n  A --> B\n```' },
    })

    const preview = await screen.findByTestId('markdown-preview')
    await waitFor(() => {
      expect(preview.querySelector('.mermaid-block svg')).not.toBeNull()
    })
    expect(mermaidRenderMock).toHaveBeenCalledWith(
      expect.stringMatching(/^markdown-mermaid-/),
      'flowchart LR\n  A --> B'
    )
  })

  it('Markdown 中 mermaid 渲染失败时显示错误而不影响整篇文档', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    mermaidRenderMock.mockRejectedValueOnce(new Error('Parse error on line 2'))

    fireEvent.change(screen.getByLabelText('内容编辑器'), {
      target: { value: '# 标题\n\n```mermaid\nflowchart ??\n```\n\n正文段落' },
    })

    const preview = await screen.findByTestId('markdown-preview')
    const errorBlock = await waitFor(() => preview.querySelector('.mermaid-inline-error'))
    expect(errorBlock).toHaveTextContent('Parse error on line 2')
    expect(preview.querySelector('h1')).toHaveTextContent('标题')
    expect(preview.textContent).toContain('正文段落')
  })

  it('Markdown 中的 mermaid 块支持缩放与全屏查看', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })

    fireEvent.change(screen.getByLabelText('内容编辑器'), {
      target: { value: '# 图\n\n```mermaid\nflowchart LR\n  A --> B\n```' },
    })

    const preview = await screen.findByTestId('markdown-preview')
    await waitFor(() => {
      expect(preview.querySelector('.mermaid-block svg')).not.toBeNull()
    })

    const block = preview.querySelector('.mermaid-block') as HTMLElement
    expect(block.querySelector('.mermaid-block-toolbar')).not.toBeNull()

    // 缩放
    const canvas = block.querySelector('.mermaid-block-canvas') as HTMLElement
    ;(block.querySelector('button[aria-label="放大图表"]') as HTMLButtonElement).click()
    expect(canvas.style.width).toBe('125%')
    expect(block.querySelector('.mermaid-block-zoom-value')?.textContent).toBe('125%')

    // 全屏打开
    ;(block.querySelector('button[title="全屏查看"]') as HTMLButtonElement).click()
    expect(document.querySelector('.mermaid-block-overlay')).not.toBeNull()

    // ESC 退出
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelector('.mermaid-block-overlay')).toBeNull()
  })

  it('可以清空代码和预览', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '清空' }))
    })

    expect(screen.getByLabelText('内容编辑器')).toHaveValue('')
    expect(screen.queryByRole('img', { name: 'Mermaid 图表预览' })).not.toBeInTheDocument()
    expect(screen.getByText(/自动识别 Mermaid \/ Markdown/)).toBeInTheDocument()
  })

  it('支持放大、缩小和重置图表', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    const diagram = await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    const canvas = screen.getByTestId('mermaid-canvas')

    fireEvent.click(screen.getByRole('button', { name: '放大图表' }))
    expect(screen.getByRole('button', { name: '重置图表缩放，当前 125%' })).toBeEnabled()
    expect(canvas).toHaveStyle({ width: '125%' })
    expect(diagram).toHaveStyle({ width: '100%', maxWidth: '60rem' })

    fireEvent.click(screen.getByRole('button', { name: '重置图表缩放，当前 125%' }))
    expect(screen.getByRole('button', { name: '重置图表缩放，当前 100%' })).toBeDisabled()
    expect(canvas).toHaveStyle({ width: '100%' })
    expect(diagram).toHaveStyle({ width: '100%', maxWidth: '48rem' })

    fireEvent.click(screen.getByRole('button', { name: '缩小图表' }))
    expect(screen.getByRole('button', { name: '重置图表缩放，当前 75%' })).toBeEnabled()
    expect(canvas).toHaveStyle({ width: '100%' })
    expect(diagram).toHaveStyle({ width: '75%', maxWidth: '36rem' })
  })

  it('支持按住鼠标拖动超出预览区的图表', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    const preview = screen.getByTestId('mermaid-preview-body')

    preview.scrollLeft = 100
    preview.scrollTop = 80
    preview.setPointerCapture = vi.fn()
    preview.hasPointerCapture = vi.fn(() => true)
    preview.releasePointerCapture = vi.fn()

    fireEvent.pointerDown(preview, {
      button: 0,
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 200,
      clientY: 150,
    })
    fireEvent.pointerMove(preview, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 150,
      clientY: 100,
    })

    expect(preview).toHaveClass('is-dragging')
    expect(preview.scrollLeft).toBe(150)
    expect(preview.scrollTop).toBe(130)

    fireEvent.pointerUp(preview, { pointerId: 1, pointerType: 'mouse' })
    fireEvent.pointerMove(preview, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 100,
      clientY: 50,
    })

    expect(preview).not.toHaveClass('is-dragging')
    expect(preview.scrollLeft).toBe(150)
    expect(preview.scrollTop).toBe(130)
  })

  it('应保存内容与预览的分割比例', () => {
    const { unmount } = render(<ToastProvider><MermaidRenderer /></ToastProvider>)

    const divider = screen.getByRole('separator', { name: '调整内容预览宽度' })
    expect(divider).toHaveAttribute('aria-valuenow', '30')
    fireEvent.keyDown(divider, { key: 'ArrowRight' })
    expect(divider).toHaveAttribute('aria-valuenow', '32')

    unmount()
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)

    expect(screen.getByRole('separator', { name: '调整内容预览宽度' })).toHaveAttribute('aria-valuenow', '32')
  })

  it('点击全屏按钮应切换全屏状态', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })

    const fullscreenButton = screen.getByRole('button', { name: /全屏/ })
    expect(fullscreenButton).toHaveTextContent('⛶ 全屏')

    fireEvent.click(fullscreenButton)

    const previewContainer = screen.getByTestId('mermaid-preview')
    expect(previewContainer).toHaveClass('fullscreen-panel')
    expect(fullscreenButton).toHaveTextContent('⤓ 退出全屏')

    fireEvent.click(fullscreenButton)
    expect(previewContainer).not.toHaveClass('fullscreen-panel')
  })

  it('全屏状态下按 ESC 键应退出全屏', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })

    const fullscreenButton = screen.getByRole('button', { name: /全屏/ })
    fireEvent.click(fullscreenButton)

    const previewContainer = screen.getByTestId('mermaid-preview')
    expect(previewContainer).toHaveClass('fullscreen-panel')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(previewContainer).not.toHaveClass('fullscreen-panel')
  })
})
