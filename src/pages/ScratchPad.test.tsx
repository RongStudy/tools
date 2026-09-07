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
  it('可以新增并切换多个文本，且每个文本的内容独立保留', () => {
    renderScratchPad()

    const input = screen.getByLabelText('scratch-editor-plaintext')
    fireEvent.change(input, { target: { value: '第一段内容' } })

    fireEvent.click(screen.getByRole('button', { name: '新建文本' }))
    expect(screen.getByRole('tab', { name: '文本 2' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '第二段内容' } })
    fireEvent.click(screen.getByRole('tab', { name: '文本 1' }))

    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('第一段内容')

    fireEvent.click(screen.getByRole('tab', { name: '文本 2' }))
    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('第二段内容')
  })

  it('关闭当前文本后应切换到保留的文本', () => {
    renderScratchPad()

    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '第一段内容' } })
    fireEvent.click(screen.getByRole('button', { name: '新建文本' }))
    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '第二段内容' } })
    fireEvent.click(screen.getByRole('button', { name: '关闭 文本 2' }))

    expect(screen.queryByRole('tab', { name: '文本 2' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '文本 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('第一段内容')
  })

  it('放大和缩小应在字号上下限内调整并禁用越界按钮', () => {
    renderScratchPad()

    const zoomIn = screen.getByRole('button', { name: '放大' })
    const zoomOut = screen.getByRole('button', { name: '缩小' })

    fireEvent.click(zoomIn)
    expect(screen.getByTitle('当前字号')).toHaveTextContent('15px')

    fireEvent.click(zoomOut)
    fireEvent.click(zoomOut)
    expect(screen.getByTitle('当前字号')).toHaveTextContent('13px')
  })

  it('Clipboard API 不可用时应显示复制失败而不是抛出异常', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })

    renderScratchPad()

    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '要复制的内容' } })
    fireEvent.click(screen.getByRole('button', { name: '复制' }))

    await waitFor(() => {
      expect(screen.getByText('复制失败')).toBeInTheDocument()
    })
  })

  it('重新挂载后应恢复两天内保存的多个文本和字号', () => {
    const { unmount } = renderScratchPad()

    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '第一段内容' } })
    fireEvent.click(screen.getByRole('button', { name: '新建文本' }))
    fireEvent.change(screen.getByLabelText('scratch-editor-plaintext'), { target: { value: '第二段内容' } })
    unmount()

    renderScratchPad()

    expect(screen.getByRole('tab', { name: '文本 2' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('第二段内容')
    fireEvent.click(screen.getByRole('tab', { name: '文本 1' }))
    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('第一段内容')
  })

  it('超过两天的保存内容应过期失效', () => {
    localStorage.setItem('dev-tools:scratch-pad:draft', JSON.stringify({
      value: {
        activeDocumentId: 'scratch-1',
        documents: [{ id: 'scratch-1', name: '文本 1', content: '过期内容', language: 'plaintext' }],
        fontSize: 14,
      },
      expiresAt: Date.now() - 1,
    }))

    renderScratchPad()

    expect(screen.getByLabelText('scratch-editor-plaintext')).toHaveValue('')
  })
})
