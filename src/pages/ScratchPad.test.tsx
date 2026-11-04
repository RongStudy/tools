import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import ScratchPad from './ScratchPad'
import { ToastProvider } from '../components/Toast'
import { deferred, memoryLocalFile } from '../test/localFileMock'

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, language }: {
    value: string
    onChange?: (value: string) => void
    language?: string
  }) => (
    <textarea
      aria-label={`scratch-editor-${language ?? 'plaintext'}`}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}))

function renderScratchPad() {
  return render(
    <ToastProvider>
      <ScratchPad />
    </ToastProvider>
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const mockDownloads = () => {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:scratch-download')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  const filenames: string[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    filenames.push(this.download)
  })
  return { createObjectURL, revokeObjectURL, filenames }
}

describe('ScratchPad', () => {
  it('默认关闭写回，不支持时无法启用', () => {
    renderScratchPad()
    expect(screen.getByRole('checkbox', { name: '写回原文件' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: '写回原文件' })).toBeDisabled()
  })

  it('启用写回后将编辑内容保存到所选文件，并阻止覆盖外部修改', async () => {
    const disk = memoryLocalFile('note.txt', '原文')
    vi.stubGlobal('showOpenFilePicker', vi.fn(async () => [disk.handle]))
    renderScratchPad()
    fireEvent.click(screen.getByRole('checkbox', { name: '写回原文件' }))
    fireEvent.click(screen.getByRole('button', { name: '加载文件' }))
    await screen.findByRole('tab', { name: 'note.txt' })
    expect(screen.getByRole('button', { name: '保存到原文件' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '修改内容' } })
    fireEvent.click(screen.getByRole('button', { name: '保存到原文件' }))
    await waitFor(() => expect(screen.getByLabelText('保存到原文件状态')).toHaveTextContent('已保存'))
    expect(disk.text).toBe('修改内容')
    disk.setDisk('外部修改')
    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '又改了' } })
    fireEvent.click(screen.getByRole('button', { name: '保存到原文件' }))
    expect(await screen.findByText('文件已在外部修改，请重新加载后再保存')).toBeInTheDocument()
    expect(disk.write).toHaveBeenCalledTimes(1)
    expect(disk.abort).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('保存到原文件状态')).toHaveTextContent('未保存')
  })

  it('保存期间继续编辑，完成后仍显示未保存，后续保存提交最新内容', async () => {
    const disk = memoryLocalFile('note.txt', '原文')
    const commit = deferred<void>()
    disk.close.mockImplementationOnce(async () => { await commit.promise; disk.setDisk('第一次修改') })
    vi.stubGlobal('showOpenFilePicker', vi.fn(async () => [disk.handle]))
    renderScratchPad()
    fireEvent.click(screen.getByRole('checkbox', { name: '写回原文件' }))
    fireEvent.click(screen.getByRole('button', { name: '加载文件' }))
    await screen.findByRole('tab', { name: 'note.txt' })
    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '第一次修改' } })
    fireEvent.click(screen.getByRole('button', { name: '保存到原文件' }))
    expect(screen.getByLabelText('保存到原文件状态')).toHaveTextContent('保存中')
    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '继续修改' } })
    await waitFor(() => expect(disk.close).toHaveBeenCalledOnce())
    await act(async () => { commit.resolve(); await commit.promise })
    expect(screen.getByLabelText('保存到原文件状态')).toHaveTextContent('未保存')
    expect(disk.text).toBe('第一次修改')
    fireEvent.click(screen.getByRole('button', { name: '保存到原文件' }))
    await waitFor(() => expect(screen.getByLabelText('保存到原文件状态')).toHaveTextContent('已保存'))
    expect(disk.text).toBe('继续修改')
  })

  it('加载本地文件为独立文本，保留已有内容和草稿', async () => {
    const { unmount } = renderScratchPad()
    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '原有内容' } })
    const file = new File([''], 'note.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('文件内容\n') })
    fireEvent.change(screen.getByLabelText('选择本地文件'), { target: { files: [file] } })
    expect(await screen.findByRole('tab', { name: 'note.txt' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('文件内容\n')
    fireEvent.click(screen.getByRole('tab', { name: '文本 1' }))
    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('原有内容')
    unmount()
    renderScratchPad()
    fireEvent.click(screen.getByRole('tab', { name: 'note.txt' }))
    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('文件内容\n')
  })

  it('读取文件失败时保留当前文本并提示', async () => {
    renderScratchPad()
    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '原有内容' } })
    const file = new File([''], 'bad.txt')
    Object.defineProperty(file, 'text', { value: () => Promise.reject(new Error('read failed')) })
    fireEvent.change(screen.getByLabelText('选择本地文件'), { target: { files: [file] } })
    expect(await screen.findByText('加载文件失败，请重试')).toBeInTheDocument()
    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('原有内容')
  })

  it('自动将包含 JSON 参数的 curl 识别为 Shell，仍允许手动选择语言', () => {
    vi.useFakeTimers()
    renderScratchPad()
    const command = 'curl https://example.com --data \'{"type": "object", "description": "as value"}\''
    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: command } })
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByLabelText('scratch-editor-shell')).toHaveValue(command)
    expect(screen.getByRole('option', { name: '自动 · Shell' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: '栏 1 语言' }), { target: { value: 'typescript' } })
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByLabelText('scratch-editor-typescript')).toHaveValue(command)
  })

  it('自动模式持续识别各栏，手动选择固定语言，重挂载后保留模式', () => {
    vi.useFakeTimers()
    const { unmount } = renderScratchPad()
    const language = screen.getByRole('combobox', { name: '栏 1 语言' })
    expect(language).toHaveValue('auto')
    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '<?php echo $name;' } })
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByLabelText('scratch-editor-php')).toBeInTheDocument()
    expect(language).toHaveValue('auto')
    fireEvent.change(screen.getByLabelText('scratch-editor-php'), { target: { value: 'package main\nfunc main() {}' } })
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByLabelText('scratch-editor-go')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /分栏/ }))
    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: 'public class Main {}' } })
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByLabelText('scratch-editor-java')).toBeInTheDocument()
    expect(screen.getByLabelText('scratch-editor-go')).toBeInTheDocument()
    fireEvent.change(language, { target: { value: 'plaintext' } })
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('package main\nfunc main() {}')
    unmount()
    renderScratchPad()
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByRole('combobox', { name: '栏 1 语言' })).toHaveValue('plaintext')
    expect(screen.getByRole('combobox', { name: '栏 2 语言' })).toHaveValue('auto')
    expect(screen.getByLabelText('scratch-editor-java')).toBeInTheDocument()
  })

  it('只下载最近获得焦点的分栏，保留完整文本并在下载后释放资源', async () => {
    vi.useFakeTimers()
    const { createObjectURL, revokeObjectURL, filenames } = mockDownloads()
    renderScratchPad()
    fireEvent.click(screen.getByRole('button', { name: /分栏/ }))
    const editors = screen.getAllByLabelText('scratch-editor-plaintext')
    fireEvent.change(editors[0], { target: { value: '不应导出的第一栏' } })
    const content = '第二栏中文内容\n<原样保存> & 😀\n'
    fireEvent.change(editors[1], { target: { value: content } })
    fireEvent.focus(editors[1])
    expect(editors[1].closest('.scratch-pane')).toHaveClass('is-active')
    const save = screen.getByRole('button', { name: '保存本栏' })
    expect(save).toHaveAttribute('title', '保存栏 2 到本地文件')
    fireEvent.blur(editors[1])
    fireEvent.focus(save)
    fireEvent.click(save)
    fireEvent.change(screen.getByLabelText('文件名'), { target: { value: '我的笔记' } })
    fireEvent.click(screen.getByRole('button', { name: /^保存$/ }))
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(await blob.text()).toBe(content)
    expect(blob.type).toBe('text/plain;charset=utf-8')
    expect(filenames).toEqual(['我的笔记.txt'])
    expect(document.querySelector('a[download]')).not.toBeInTheDocument()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:scratch-download')
  })

  it('记住每个文本的当前栏，关闭当前栏后只保存仍存在的分栏', async () => {
    const { createObjectURL } = mockDownloads()
    renderScratchPad()
    fireEvent.click(screen.getByRole('button', { name: /分栏/ }))
    const editors = screen.getAllByLabelText('scratch-editor-plaintext')
    fireEvent.change(editors[0], { target: { value: '保留的第一栏' } })
    fireEvent.change(editors[1], { target: { value: '原文本第二栏' } })
    fireEvent.pointerDown(editors[1])
    fireEvent.click(screen.getByRole('button', { name: '新建文本' }))
    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '新文本内容' } })
    fireEvent.click(screen.getByRole('button', { name: '保存本栏' }))
    fireEvent.click(screen.getByRole('button', { name: /^保存$/ }))
    expect(await (createObjectURL.mock.calls[0][0] as Blob).text()).toBe('新文本内容')
    fireEvent.click(screen.getByRole('tab', { name: '文本 1' }))
    fireEvent.click(screen.getByRole('button', { name: '保存本栏' }))
    expect(screen.getByLabelText('文件名')).toHaveValue('文本 1-栏 2.txt')
    fireEvent.click(screen.getByRole('button', { name: /^保存$/ }))
    expect(await (createObjectURL.mock.calls[1][0] as Blob).text()).toBe('原文本第二栏')
    fireEvent.click(screen.getByRole('button', { name: '关闭栏 2' }))
    fireEvent.click(screen.getByRole('button', { name: '保存本栏' }))
    fireEvent.click(screen.getByRole('button', { name: /^保存$/ }))
    expect(await (createObjectURL.mock.calls[2][0] as Blob).text()).toBe('保留的第一栏')
  })

  it('全屏模式也能保存当前空分栏', async () => {
    const { createObjectURL } = mockDownloads()
    renderScratchPad()
    fireEvent.click(screen.getByTitle('浏览器内全屏'))
    fireEvent.click(screen.getByRole('button', { name: '保存本栏' }))
    fireEvent.keyDown(screen.getByLabelText('文件名'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTitle('退出全屏')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '保存本栏' }))
    fireEvent.click(screen.getByRole('button', { name: /^保存$/ }))
    expect(await (createObjectURL.mock.calls[0][0] as Blob).text()).toBe('')
  })

  it('下载失败时提供提示而不改变各栏内容', async () => {
    const { createObjectURL } = mockDownloads()
    createObjectURL.mockImplementation(() => { throw new Error('download unavailable') })
    renderScratchPad()
    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '仍保留的内容' } })
    fireEvent.click(screen.getByRole('button', { name: '保存本栏' }))
    fireEvent.click(screen.getByRole('button', { name: /^保存$/ }))
    expect(await screen.findByText('保存文件失败，请重试')).toBeInTheDocument()
    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('仍保留的内容')
  })

  it('新增分栏最多三个，超过后按钮禁用', () => {
    renderScratchPad()

    const addPane = screen.getByRole('button', { name: /分栏/ })

    fireEvent.click(addPane)
    expect(screen.getAllByLabelText('scratch-editor-plaintext')).toHaveLength(2)

    fireEvent.click(addPane)
    expect(screen.getAllByLabelText('scratch-editor-plaintext')).toHaveLength(3)

    expect(addPane).toBeDisabled()
  })

  it('可以关闭分栏，且各分栏内容独立', () => {
    renderScratchPad()

    fireEvent.click(screen.getByRole('button', { name: /分栏/ }))
    fireEvent.click(screen.getByRole('button', { name: /分栏/ }))

    const editors = screen.getAllByLabelText('scratch-editor-plaintext')
    fireEvent.change(editors[0], { target: { value: '第一栏内容' } })
    fireEvent.change(editors[1], { target: { value: '第二栏内容' } })
    fireEvent.change(editors[2], { target: { value: '第三栏内容' } })

    fireEvent.click(screen.getByRole('button', { name: '关闭栏 2' }))

    const remaining = screen.getAllByLabelText('scratch-editor-plaintext')
    expect(remaining).toHaveLength(2)
    expect(remaining[0]).toHaveValue('第一栏内容')
    expect(remaining[1]).toHaveValue('第三栏内容')
  })

  it('可以新增并切换多个文本，且每个文本的内容独立保留', () => {
    renderScratchPad()

    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '第一段内容' } })

    fireEvent.click(screen.getByRole('button', { name: '新建文本' }))
    expect(screen.getByRole('tab', { name: '文本 2' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '第二段内容' } })
    fireEvent.click(screen.getByRole('tab', { name: '文本 1' }))
    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('第一段内容')

    fireEvent.click(screen.getByRole('tab', { name: '文本 2' }))
    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('第二段内容')
  })

  it('放大和缩小应在字号上下限内调整', () => {
    renderScratchPad()

    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    expect(screen.getByTitle('当前字号')).toHaveTextContent('15px')

    fireEvent.click(screen.getByRole('button', { name: '缩小' }))
    fireEvent.click(screen.getByRole('button', { name: '缩小' }))
    expect(screen.getByTitle('当前字号')).toHaveTextContent('13px')
  })

  it('Clipboard API 不可用时应显示复制失败而不是抛出异常', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })

    renderScratchPad()

    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '要复制的内容' } })
    fireEvent.click(screen.getAllByRole('button', { name: '复制' })[0])

    await waitFor(() => {
      expect(screen.getByText('复制失败')).toBeInTheDocument()
    })
  })

  it('浏览器内全屏应隐藏标签并显示退出全屏按钮', () => {
    renderScratchPad()

    fireEvent.click(screen.getByTitle('浏览器内全屏'))

    expect(screen.getByTitle('退出全屏')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTitle('退出全屏'))
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })

  it('重新挂载后应恢复两天内保存的多个文本和分栏', () => {
    const { unmount } = renderScratchPad()

    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '第一栏内容' } })
    fireEvent.click(screen.getByRole('button', { name: /分栏/ }))
    fireEvent.change(screen.getAllByLabelText('scratch-editor-plaintext')[1], { target: { value: '第二栏内容' } })
    unmount()

    renderScratchPad()

    const editors = screen.getAllByLabelText('scratch-editor-plaintext')
    expect(editors).toHaveLength(2)
    expect(editors[0]).toHaveValue('第一栏内容')
    expect(editors[1]).toHaveValue('第二栏内容')
  })

  it('应兼容恢复旧版单内容文档草稿', () => {
    localStorage.setItem('dev-tools:scratch-pad:draft', JSON.stringify({
      value: {
        activeDocumentId: 'scratch-1',
        documents: [{ id: 'scratch-1', name: '文本 1', content: '旧版内容', language: 'plaintext' }],
        fontSize: 14,
      },
      expiresAt: Date.now() + 1_000,
    }))

    renderScratchPad()

    expect(screen.getAllByLabelText('scratch-editor-plaintext')).toHaveLength(1)
    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('旧版内容')
  })

  it('超过两天的保存内容应过期失效', () => {
    localStorage.setItem('dev-tools:scratch-pad:draft', JSON.stringify({
      value: {
        activeDocumentId: 'scratch-1',
        documents: [{ id: 'scratch-1', name: '文本 1', panes: [{ id: 'pane-1', content: '过期内容', language: 'plaintext' }] }],
        fontSize: 14,
      },
      expiresAt: Date.now() - 1,
    }))

    renderScratchPad()

    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('')
  })
})
