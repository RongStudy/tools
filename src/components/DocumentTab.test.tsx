import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DocumentTab from './DocumentTab'

function setup() {
  const onRename = vi.fn()
  const onSelect = vi.fn()
  render(<DocumentTab name="JSON 1" prefix="json" selected onSelect={onSelect} onRename={onRename} />)
  return { onRename, onSelect }
}

describe('DocumentTab', () => {
  it('double-click selects the document and saves a trimmed name once on Enter', () => {
    const { onRename, onSelect } = setup()
    fireEvent.doubleClick(screen.getByRole('tab'))
    expect(onSelect).toHaveBeenCalledOnce()
    const input = screen.getByRole('textbox', { name: '重命名 JSON 1' })
    expect(input).toHaveFocus()
    fireEvent.change(input, { target: { value: '  用户信息接口  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledExactlyOnceWith('用户信息接口')
    expect(screen.getByRole('tab')).toHaveFocus()
  })

  it('F2 edits the label, Escape cancels, and empty names do not replace it', () => {
    const { onRename } = setup()
    fireEvent.keyDown(screen.getByRole('tab'), { key: 'F2' })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '未保存' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByRole('tab')).toHaveFocus()
    fireEvent.doubleClick(screen.getByRole('tab'))
    expect(screen.getByRole('textbox')).toHaveValue('JSON 1')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  ' } })
    fireEvent.blur(screen.getByRole('textbox'))
    expect(onRename).not.toHaveBeenCalled()
  })

  it('does not submit Enter during Chinese composition, and saves on blur', () => {
    const { onRename } = setup()
    fireEvent.doubleClick(screen.getByRole('tab'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '订单详情' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(onRename).not.toHaveBeenCalled()
    expect(input).toBeInTheDocument()
    fireEvent.blur(input)
    expect(onRename).toHaveBeenCalledExactlyOnceWith('订单详情')
  })
})
