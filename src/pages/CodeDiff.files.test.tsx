import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CodeDiff from './CodeDiff'
import { ToastProvider } from '../components/Toast'
import { deferred, memoryLocalFile } from '../test/localFileMock'

const callbacks = vi.hoisted(() => ({
  current: {} as { onOriginalChange?: (value: string) => void; onModifiedChange?: (value: string) => void },
}))
vi.mock('../hooks/useDiffEditor', () => {
  const methods = {
    handleEditorMount: vi.fn(),
    navigateToNextDiff: vi.fn(),
    navigateToPreviousDiff: vi.fn(),
    getDiffCount: () => 0,
    ensureEditable: () => undefined,
    setEditorCallbacks: (next: typeof callbacks.current) => { callbacks.current = next },
  }
  return { useDiffEditor: () => methods }
})
vi.mock('@monaco-editor/react', () => ({
  DiffEditor: ({ original, modified }: { original: string; modified: string }) => <>
    <textarea aria-label="original-code" value={original} readOnly />
    <textarea aria-label="modified-code" value={modified} readOnly />
  </>,
}))

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

function renderDiff() { return render(<ToastProvider><CodeDiff /></ToastProvider>) }
function enableWriteback() { fireEvent.click(screen.getByRole('checkbox', { name: '写回原文件' })) }

describe('CodeDiff 本地文件', () => {
  it('在后台完成读取仅更新发起操作的标签', async () => {
    const read = deferred<ArrayBuffer>()
    const disk = memoryLocalFile('slow.txt', '属于对比1的文件')
    vi.mocked(disk.handle.getFile).mockResolvedValueOnce({ name: 'slow.txt', arrayBuffer: () => read.promise } as File)
    vi.stubGlobal('showOpenFilePicker', vi.fn(async () => [disk.handle]))
    renderDiff()
    enableWriteback()
    fireEvent.click(screen.getByRole('button', { name: '加载原始文件' }))
    fireEvent.click(screen.getByRole('button', { name: '新建对比' }))
    await act(async () => { read.resolve(new TextEncoder().encode('属于对比1的文件').buffer); await read.promise })
    expect(screen.getByLabelText('original-code')).toHaveValue('')
    expect(screen.queryByRole('button', { name: '保存原始文件' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '对比 1' }))
    expect(screen.getByLabelText('original-code')).toHaveValue('属于对比1的文件')
    expect(screen.getByRole('button', { name: '保存原始文件' })).toBeDisabled()
  })

  it('读取完成前关闭目标标签，不恢复文件关联或污染剩余标签', async () => {
    const read = deferred<ArrayBuffer>()
    const disk = memoryLocalFile('closed.txt', '')
    vi.mocked(disk.handle.getFile).mockResolvedValueOnce({ name: 'closed.txt', arrayBuffer: () => read.promise } as File)
    vi.stubGlobal('showOpenFilePicker', vi.fn(async () => [disk.handle]))
    renderDiff()
    fireEvent.click(screen.getByRole('button', { name: '新建对比' }))
    enableWriteback()
    fireEvent.click(screen.getByRole('button', { name: '加载修改文件' }))
    fireEvent.click(screen.getByRole('button', { name: '关闭 对比 2' }))
    await act(async () => { read.resolve(new TextEncoder().encode('过期结果').buffer); await read.promise })
    expect(screen.getByLabelText('modified-code')).toHaveValue('')
    expect(screen.queryByRole('button', { name: '保存修改文件' })).not.toBeInTheDocument()
    expect(screen.queryByText('文件加载成功: closed.txt')).not.toBeInTheDocument()
  })

  it('普通加载乱序完成时仅采用最近一次结果', async () => {
    const first = deferred<string>()
    renderDiff()
    const slow = new File([], 'slow.txt')
    Object.defineProperty(slow, 'text', { value: () => first.promise })
    fireEvent.change(screen.getByLabelText('加载原始文件'), { target: { files: [slow] } })
    fireEvent.change(screen.getByLabelText('加载原始文件'), { target: { files: [new File(['最新结果'], 'latest.txt')] } })
    await waitFor(() => expect(screen.getByLabelText('original-code')).toHaveValue('最新结果'))
    await act(async () => { first.resolve('过期结果'); await first.promise })
    expect(screen.getByLabelText('original-code')).toHaveValue('最新结果')
  })

  it('交换后写入对应原文件，成功提交后再显示已保存', async () => {
    const original = memoryLocalFile('a.txt', '原始内容')
    const modified = memoryLocalFile('b.txt', '修改内容')
    vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValueOnce([original.handle]).mockResolvedValueOnce([modified.handle]))
    renderDiff()
    enableWriteback()
    fireEvent.click(screen.getByRole('button', { name: '加载原始文件' }))
    await screen.findByRole('button', { name: '保存原始文件' })
    fireEvent.click(screen.getByRole('button', { name: '加载修改文件' }))
    await screen.findByRole('button', { name: '保存修改文件' })
    act(() => callbacks.current.onModifiedChange?.('修改后的内容'))
    fireEvent.click(screen.getByRole('button', { name: '交换' }))
    expect(screen.getByLabelText('保存原始文件状态')).toHaveTextContent('未保存')
    fireEvent.click(screen.getByRole('button', { name: '保存原始文件' }))
    await waitFor(() => expect(screen.getByLabelText('保存原始文件状态')).toHaveTextContent('已保存'))
    expect(modified.text).toBe('修改后的内容')
    expect(modified.close).toHaveBeenCalledOnce()
    expect(original.handle.createWritable).not.toHaveBeenCalled()
  })

  it('保存过程中交换两侧，成功基线跟随文件移动', async () => {
    const disk = memoryLocalFile('a.txt', '原始内容')
    const other = memoryLocalFile('b.txt', '其他内容')
    const commit = deferred<void>()
    disk.close.mockImplementationOnce(async () => { await commit.promise; disk.setDisk('已修改') })
    vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValueOnce([disk.handle]).mockResolvedValueOnce([other.handle]))
    renderDiff()
    enableWriteback()
    fireEvent.click(screen.getByRole('button', { name: '加载原始文件' }))
    await screen.findByRole('button', { name: '保存原始文件' })
    fireEvent.click(screen.getByRole('button', { name: '加载修改文件' }))
    await screen.findByRole('button', { name: '保存修改文件' })
    act(() => callbacks.current.onOriginalChange?.('已修改'))
    fireEvent.click(screen.getByRole('button', { name: '保存原始文件' }))
    await waitFor(() => expect(disk.close).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: '交换' }))
    expect(screen.getByLabelText('保存修改文件状态')).toHaveTextContent('保存中')
    await act(async () => { commit.resolve(); await commit.promise })
    expect(screen.getByLabelText('保存修改文件状态')).toHaveTextContent('已保存')
    expect(disk.text).toBe('已修改')
  })

  it('权限拒绝后仍保留未保存内容，可以再次保存', async () => {
    const disk = memoryLocalFile('a.txt', '原始内容')
    vi.stubGlobal('showOpenFilePicker', vi.fn(async () => [disk.handle]))
    renderDiff()
    enableWriteback()
    fireEvent.click(screen.getByRole('button', { name: '加载原始文件' }))
    await screen.findByRole('button', { name: '保存原始文件' })
    act(() => callbacks.current.onOriginalChange?.('待保存内容'))
    vi.mocked(disk.handle.createWritable).mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
    fireEvent.click(screen.getByRole('button', { name: '保存原始文件' }))
    await screen.findByText('文件访问未获授权，请重新选择文件并允许访问')
    expect(screen.getByLabelText('保存原始文件状态')).toHaveTextContent('未保存')
    fireEvent.click(screen.getByRole('button', { name: '保存原始文件' }))
    await waitFor(() => expect(disk.text).toBe('待保存内容'))
  })
})
