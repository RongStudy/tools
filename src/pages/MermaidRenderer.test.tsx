import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorProps } from '@monaco-editor/react'
import { ToastProvider } from '../components/Toast'
import { ThemeProvider } from '../theme'
import { useAppTheme } from '../themeContext'
import { memoryLocalFile } from '../test/localFileMock'
import { writeExpiringStorage } from '../utils/expiringStorage'
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
        Uri: { parse: (path: string) => path },
        editor: { setModelMarkers: setMarkersMock, getModel: () => null },
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


function openOptions(name: string | RegExp) {
  const trigger = screen.getByRole('button', { name })
  if (trigger.getAttribute('aria-expanded') !== 'true') fireEvent.click(trigger)
}

describe('MermaidRenderer', () => {
  afterEach(() => vi.unstubAllGlobals())

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
      const { setThemePreference } = useAppTheme()
      return <button onClick={() => setThemePreference('light')}>切换主题</button>
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

  it('各标签独立保留内容、设置和名称，重新打开时恢复活动标签', async () => {
    const { unmount } = render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    fireEvent.click(screen.getByRole('button', { name: '放大图表' }))
    fireEvent.click(screen.getByRole('button', { name: '新建文档' }))
    expect(screen.getByRole('tab', { name: 'Mermaid 2' })).toHaveFocus()
    expect(screen.getByLabelText('内容编辑器')).toHaveValue('')
    expect(screen.queryByRole('img', { name: 'Mermaid 图表预览' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: '渲染格式' }), { target: { value: 'markdown' } })
    fireEvent.change(screen.getByLabelText('内容编辑器'), { target: { value: '# 标签二' } })
    await screen.findByTestId('markdown-preview')
    openOptions('预览选项')
    fireEvent.click(screen.getByRole('button', { name: '居中' }))
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Mermaid 2' }), { key: 'F2' })
    const nameInput = screen.getByRole('textbox', { name: '重命名 Mermaid 2' })
    fireEvent.change(nameInput, { target: { value: '文档草稿' } })
    fireEvent.keyDown(nameInput, { key: 'Enter' })

    fireEvent.keyDown(screen.getByRole('tab', { name: '文档草稿' }), { key: 'ArrowLeft' })
    expect(screen.getByLabelText('内容编辑器')).toHaveValue(DEFAULT_MERMAID_CODE)
    expect(screen.getByRole('combobox', { name: '渲染格式' })).toHaveValue('auto')
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    expect(screen.getByRole('button', { name: '重置图表缩放，当前 125%' })).toBeEnabled()

    fireEvent.click(screen.getByRole('tab', { name: '文档草稿' }))
    unmount()
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    expect(screen.getByRole('tab', { name: '文档草稿' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('内容编辑器')).toHaveValue('# 标签二')
    expect(screen.getByRole('combobox', { name: '渲染格式' })).toHaveValue('markdown')
    expect(await screen.findByTestId('markdown-preview')).toHaveClass('layout-centered')

    fireEvent.click(screen.getByRole('button', { name: '关闭 文档草稿' }))
    expect(screen.getByRole('tab', { name: 'Mermaid 1' })).toHaveFocus()
    expect(screen.getByLabelText('内容编辑器')).toHaveValue(DEFAULT_MERMAID_CODE)
    expect(screen.queryByRole('tab', { name: '文档草稿' })).not.toBeInTheDocument()
  })

  it('将旧版单文档草稿保留在首个标签', () => {
    writeExpiringStorage('dev-tools:mermaid-renderer:draft', '# 旧版草稿')
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    expect(screen.getByRole('tab', { name: 'Mermaid 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('内容编辑器')).toHaveValue('# 旧版草稿')
  })

  it('切换标签后丢弃上一标签尚未完成的预览和文件读取', async () => {
    let finishRender!: (result: { svg: string }) => void
    let finishRead!: (source: string) => void
    mermaidRenderMock.mockImplementationOnce(() => new Promise((resolve) => { finishRender = resolve }))
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await waitFor(() => expect(mermaidRenderMock).toHaveBeenCalled())
    const file = Object.assign(new File([], '慢文件.md'), {
      text: () => new Promise<string>((resolve) => { finishRead = resolve }),
    })
    fireEvent.change(screen.getByLabelText('选择 Markdown 或 Mermaid 文件'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: '新建文档' }))
    await act(async () => {
      finishRender({ svg: '<svg><text>old diagram</text></svg>' })
      finishRead('# 旧文件')
    })
    expect(screen.getByLabelText('内容编辑器')).toHaveValue('')
    expect(screen.queryByRole('img', { name: 'Mermaid 图表预览' })).not.toBeInTheDocument()
  })

  it('加载 Markdown 到新标签，移除 BOM 并保留原标签内容和模式', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    fireEvent.change(screen.getByRole('combobox', { name: '渲染格式' }), { target: { value: 'mermaid' } })
    const file = new File(['\uFEFF# 本地文档\n\n正文'], '说明.md')
    fireEvent.change(screen.getByLabelText('选择 Markdown 或 Mermaid 文件'), { target: { files: [file] } })
    expect(await screen.findByTestId('markdown-preview')).toHaveTextContent('本地文档')
    expect(screen.getByLabelText('内容编辑器')).toHaveValue('# 本地文档\n\n正文')
    expect(screen.getByRole('combobox', { name: '渲染格式' })).toHaveValue('auto')
    expect(screen.getByTitle('说明.md')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '说明.md' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('button', { name: '保存到原文件' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭 说明.md' }))
    expect(screen.queryByRole('tab', { name: '说明.md' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('内容编辑器')).toHaveValue(DEFAULT_MERMAID_CODE)
    expect(screen.getByRole('combobox', { name: '渲染格式' })).toHaveValue('mermaid')
  })

  it('拖入 Mermaid 文件时高亮面板并加载图表', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    const panel = screen.getByLabelText('内容编辑器').closest('.editor-panel')!
    const source = 'sequenceDiagram\n A->>B: 本地图表'
    const dataTransfer = { types: ['Files'], files: [new File([source], '时序.mmd')], dropEffect: 'none' }
    fireEvent.dragOver(panel, { dataTransfer })
    expect(panel).toHaveClass('is-file-dragging')
    fireEvent.drop(panel, { dataTransfer })
    expect(panel).not.toHaveClass('is-file-dragging')
    await waitFor(() => expect(screen.getByLabelText('内容编辑器')).toHaveValue(source))
    expect(screen.getByRole('tab', { name: '时序.mmd' })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(mermaidRenderMock).toHaveBeenLastCalledWith(expect.any(String), source))
  })

  it('加载可写文件后能保存到原文件，并可关闭最后一个文件标签', async () => {
    const disk = memoryLocalFile('示例.md', '\ufeff# 原文')
    const picker = vi.fn(async () => [disk.handle])
    vi.stubGlobal('showOpenFilePicker', picker)
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    expect(screen.queryByRole('button', { name: '保存到原文件' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '加载文件' }))
    expect(await screen.findByRole('tab', { name: '示例.md' })).toHaveFocus()
    expect(picker).toHaveBeenCalledOnce()
    const save = screen.getByRole('button', { name: '保存到原文件' })
    expect(save).toBeDisabled()
    expect(disk.handle.createWritable).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('内容编辑器'), { target: { value: '# 编辑后' } })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    await waitFor(() => expect(save).toBeDisabled())
    expect([...disk.bytes]).toEqual([...new TextEncoder().encode('\ufeff# 编辑后')])

    fireEvent.click(screen.getByRole('button', { name: '关闭 Mermaid 1' }))
    fireEvent.click(screen.getByRole('button', { name: '关闭 示例.md' }))
    expect(screen.getByRole('tab', { name: 'Mermaid 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('内容编辑器')).toHaveValue('')
    expect(screen.queryByRole('button', { name: '保存到原文件' })).not.toBeInTheDocument()
  })

  it('拖入带文件句柄的图表时可以写回', async () => {
    const source = 'flowchart LR\n  A --> B'
    const disk = memoryLocalFile('chart.mmd', source)
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    const panel = screen.getByLabelText('内容编辑器').closest('.editor-panel')!
    const getAsFileSystemHandle = vi.fn(async () => ({ kind: 'file', ...disk.handle }))
    fireEvent.drop(panel, { dataTransfer: {
      files: [new File([source], 'chart.mmd')],
      items: [{ kind: 'file', getAsFileSystemHandle }],
    } })
    expect(getAsFileSystemHandle).toHaveBeenCalledOnce()
    expect(await screen.findByRole('tab', { name: 'chart.mmd' })).toHaveFocus()
    expect(screen.getByRole('button', { name: '保存到原文件' })).toBeDisabled()
  })

  it('读取失败、二进制或不支持的文件不会替换已有内容', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    const fileInput = screen.getByLabelText('选择 Markdown 或 Mermaid 文件')
    const failed = Object.assign(new File([], '失败.md'), { text: vi.fn().mockRejectedValue(new Error('read failed')) })
    fireEvent.change(fileInput, { target: { files: [failed] } })
    await screen.findByText('读取文件失败：失败.md')
    fireEvent.change(fileInput, { target: { files: [new File(['a\0b'], '二进制.txt')] } })
    await screen.findByText('读取文件失败：二进制.txt')
    fireEvent.change(fileInput, { target: { files: [new File(['image'], '图片.png')] } })
    await screen.findByText('请选择 Markdown、Mermaid 或文本文件')
    expect(screen.getByLabelText('内容编辑器')).toHaveValue(DEFAULT_MERMAID_CODE)
  })

  it('慢读取不会覆盖较晚加载的文件或手动编辑', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    let finishRead!: (source: string) => void
    const read = () => new Promise<string>((resolve) => { finishRead = resolve })
    const slow = Object.assign(new File([], '慢文件.md'), { text: read })
    const fileInput = screen.getByLabelText('选择 Markdown 或 Mermaid 文件')
    fireEvent.change(fileInput, { target: { files: [slow] } })
    fireEvent.change(fileInput, { target: { files: [new File(['# 最新文件'], '最新.md')] } })
    await waitFor(() => expect(screen.getByLabelText('内容编辑器')).toHaveValue('# 最新文件'))
    await act(async () => { finishRead('# 旧文件') })
    expect(screen.getByLabelText('内容编辑器')).toHaveValue('# 最新文件')
    fireEvent.change(fileInput, { target: { files: [slow] } })
    fireEvent.change(screen.getByLabelText('内容编辑器'), { target: { value: '# 手动编辑' } })
    await act(async () => { finishRead('# 旧文件') })
    expect(screen.getByLabelText('内容编辑器')).toHaveValue('# 手动编辑')
  })

  it('重复加载同名文件为两个独立标签，均可渲染解析错误', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    mermaidRenderMock.mockRejectedValue(new Error('Parse error on line 1'))
    const file = new File(['flowchart ???'], '错误.mermaid')
    const fileInput = screen.getByLabelText('选择 Markdown 或 Mermaid 文件')
    fireEvent.change(fileInput, { target: { files: [file] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Parse error on line 1')
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => expect(screen.getAllByText('已加载 错误.mermaid')).toHaveLength(2))
    expect(screen.getAllByRole('tab', { name: '错误.mermaid' })).toHaveLength(2)
    expect(fileInput).toHaveValue('')
    expect(await screen.findByRole('alert')).toHaveTextContent('Parse error on line 1')
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
    fireEvent.change(screen.getByRole('combobox', { name: '渲染格式' }), { target: { value: 'markdown' } })
    await screen.findByTestId('markdown-preview')
    expect(setMarkersMock.mock.lastCall?.[2]).toEqual([])
  })

  it('渲染快捷键使用最新模式并同步编辑器语言', async () => {
    render(<ToastProvider><MermaidRenderer /></ToastProvider>)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    fireEvent.change(screen.getByRole('combobox', { name: '渲染格式' }), { target: { value: 'markdown' } })
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
    fireEvent.change(screen.getByRole('combobox', { name: '渲染格式' }), { target: { value: 'markdown' } })
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: '渲染格式' })).toHaveValue('markdown')
    })

    fireEvent.change(screen.getByLabelText('内容编辑器'), {
      target: { value: 'Hello **world**' },
    })
    const preview = await screen.findByTestId('markdown-preview')
    expect(preview.querySelector('strong')).toHaveTextContent('world')

    // 切回自动模式 → 内容首行非 Mermaid 关键字，仍按 Markdown 渲染
    fireEvent.change(screen.getByRole('combobox', { name: '渲染格式' }), { target: { value: 'auto' } })
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: '渲染格式' })).toHaveValue('auto')
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
    openOptions('预览选项')
    expect(screen.getByRole('button', { name: '铺满' })).toHaveAttribute('aria-pressed', 'true')

    openOptions('预览选项')
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
    openOptions('预览选项')
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

    fireEvent.click(screen.getByRole('button', { name: '清空' }))

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
    expect(fullscreenButton).toHaveAccessibleName('全屏查看')

    fireEvent.click(fullscreenButton)

    const previewContainer = screen.getByTestId('mermaid-preview')
    expect(previewContainer).toHaveClass('fullscreen-panel')
    expect(fullscreenButton).toHaveAccessibleName('退出全屏')

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
