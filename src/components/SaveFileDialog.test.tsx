import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SaveFileDialog from './SaveFileDialog'
import { ToastProvider } from './Toast'

beforeEach(() => vi.restoreAllMocks())
afterEach(() => vi.unstubAllGlobals())

const setup = () => {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:save-file')
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
  const filenames: string[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    filenames.push(this.download)
  })
  const onClose = vi.fn()
  render(<ToastProvider><SaveFileDialog content={'完整文本\n😀'} defaultFilename="笔记.txt" mimeType="text/plain;charset=utf-8" onClose={onClose} /></ToastProvider>)
  return { createObjectURL, filenames, onClose }
}

describe('SaveFileDialog', () => {
  it('支持键盘提交，并保留自定义扩展名', async () => {
    const user = userEvent.setup()
    const { createObjectURL, filenames, onClose } = setup()
    expect(screen.getByLabelText('文件名')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('文件名'), { target: { value: '  我的笔记.md  ' } })
    await user.keyboard('{Enter}')
    expect(filenames).toEqual(['我的笔记.md'])
    expect(await createObjectURL.mock.calls[0][0].text()).toBe('完整文本\n😀')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('空白和无效文件名不触发下载，修正后可重试', () => {
    const { createObjectURL, filenames } = setup()
    for (const name of ['   ', '../note.txt', 'note?.txt', 'note.']) {
      fireEvent.change(screen.getByLabelText('文件名'), { target: { value: name } })
      fireEvent.click(screen.getByRole('button', { name: /^保存$/ }))
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(createObjectURL).not.toHaveBeenCalled()
    }
    fireEvent.change(screen.getByLabelText('文件名'), { target: { value: '合法文件名' } })
    fireEvent.click(screen.getByRole('button', { name: /^保存$/ }))
    expect(filenames).toEqual(['合法文件名.txt'])
  })

  it('失败保留文件名并允许重试', () => {
    const { createObjectURL, onClose } = setup()
    createObjectURL.mockImplementationOnce(() => { throw new Error('download unavailable') })
    fireEvent.click(screen.getByRole('button', { name: /^保存$/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('保存文件失败，请重试')
    expect(screen.getByLabelText('文件名')).toHaveValue('笔记.txt')
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^保存$/ }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('限制焦点在弹窗内，取消和 Escape 均不下载', async () => {
    const user = userEvent.setup()
    const { onClose, createObjectURL } = setup()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: /^保存$/ })).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('文件名')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
