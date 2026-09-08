import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ScratchPad from './ScratchPad'
import { ToastProvider } from '../components/Toast'

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

describe('ScratchPad', () => {
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
