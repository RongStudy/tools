import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MermaidRenderer, { DEFAULT_MERMAID_CODE } from './MermaidRenderer'

const { mermaidRenderMock } = vi.hoisted(() => ({
  mermaidRenderMock: vi.fn(),
}))

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: mermaidRenderMock,
  },
}))

vi.mock('@monaco-editor/react', () => ({
  default: ({
    value,
    onChange,
  }: {
    value?: string
    onChange?: (value: string | undefined) => void
  }) => (
    <textarea
      aria-label="Mermaid 代码编辑器"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}))

describe('MermaidRenderer', () => {
  beforeEach(() => {
    localStorage.clear()
    mermaidRenderMock.mockReset()
    mermaidRenderMock.mockResolvedValue({
      svg: '<svg viewBox="0 0 120 60"><text>diagram</text></svg>',
    })
  })

  it('默认示例会自动渲染为图表', async () => {
    render(<MermaidRenderer />)

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
    render(<MermaidRenderer />)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    mermaidRenderMock.mockClear()

    fireEvent.change(screen.getByLabelText('Mermaid 代码编辑器'), {
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
    render(<MermaidRenderer />)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })
    mermaidRenderMock.mockRejectedValueOnce(new Error('Parse error on line 2'))

    fireEvent.change(screen.getByLabelText('Mermaid 代码编辑器'), {
      target: { value: 'flowchart ???' },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Parse error on line 2')
    expect(screen.queryByRole('img', { name: 'Mermaid 图表预览' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('语法错误')
  })

  it('可以清空代码和预览', async () => {
    render(<MermaidRenderer />)
    await screen.findByRole('img', { name: 'Mermaid 图表预览' })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '清空' }))
    })

    expect(screen.getByLabelText('Mermaid 代码编辑器')).toHaveValue('')
    expect(screen.queryByRole('img', { name: 'Mermaid 图表预览' })).not.toBeInTheDocument()
    expect(screen.getByText('输入 Mermaid 代码后将在这里显示图表')).toBeInTheDocument()
  })

  it('支持放大、缩小和重置图表', async () => {
    render(<MermaidRenderer />)
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
    render(<MermaidRenderer />)
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
})
