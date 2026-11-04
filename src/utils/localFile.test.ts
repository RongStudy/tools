import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryLocalFile } from '../test/localFileMock'
import { LocalFileError, localFileErrorMessage, openWritableFile, writeLocalFile } from './localFile'

afterEach(() => vi.unstubAllGlobals())

const open = async (disk: ReturnType<typeof memoryLocalFile>) => {
  vi.stubGlobal('showOpenFilePicker', vi.fn(async () => [disk.handle]))
  return openWritableFile()
}

describe('localFile', () => {
  it('保留 UTF-8 BOM、中文和换行，未修改时不打开写入流', async () => {
    const disk = memoryLocalFile('bom.txt', '\ufeff原文\r\n')
    const opened = await open(disk)
    expect(opened.content).toBe('原文\r\n')
    await writeLocalFile(opened, opened.content)
    expect(disk.handle.createWritable).not.toHaveBeenCalled()
    const saved = await writeLocalFile(opened, '修改😀\r\n')
    expect([...disk.bytes]).toEqual([...new TextEncoder().encode('\ufeff修改😀\r\n')])
    expect(opened.content).toBe('原文\r\n')
    expect(saved.content).toBe('修改😀\r\n')
    await writeLocalFile(saved, '再改一次\r\n')
    expect(disk.text).toBe('再改一次\r\n')
  })

  it.each([
    ['GBK', [0xd6, 0xd0]],
    ['UTF-16', [0xff, 0xfe, 0x61, 0x00]],
    ['二进制', [0x61, 0x00, 0x62]],
  ])('拒绝 %s 的有损写回', async (_name, bytes) => {
    const disk = memoryLocalFile('unsupported.txt', new Uint8Array(bytes))
    await expect(open(disk)).rejects.toMatchObject({ code: 'encoding' })
    expect(disk.handle.createWritable).not.toHaveBeenCalled()
    expect([...disk.bytes]).toEqual(bytes)
  })

  it('按字节识别外部改动，包括 BOM 变化，并取消提交', async () => {
    const disk = memoryLocalFile('note.txt', '原文')
    const opened = await open(disk)
    disk.setDisk('\ufeff原文')
    await expect(writeLocalFile(opened, '修改')).rejects.toMatchObject({ code: 'conflict' })
    expect(disk.abort).toHaveBeenCalledOnce()
    expect(disk.close).not.toHaveBeenCalled()
    expect(disk.write).not.toHaveBeenCalled()
    expect([...disk.bytes]).toEqual([...new TextEncoder().encode('\ufeff原文')])
  })

  it.each(['write', 'close'] as const)('%s 失败时保留磁盘和保存基线，允许重试', async (operation) => {
    const disk = memoryLocalFile('note.txt', '原文')
    const opened = await open(disk)
    disk[operation].mockRejectedValueOnce(new Error('disk failure'))
    await expect(writeLocalFile(opened, '修改')).rejects.toThrow('disk failure')
    expect(disk.text).toBe('原文')
    expect(opened.content).toBe('原文')
    expect(disk.abort).toHaveBeenCalledOnce()
    await writeLocalFile(opened, '重试')
    expect(disk.text).toBe('重试')
  })

  it('明确区分权限、冲突和其他错误', () => {
    expect(localFileErrorMessage(new DOMException('denied', 'NotAllowedError'), 'save')).toContain('未获授权')
    expect(localFileErrorMessage(new LocalFileError('conflict', '冲突提示'), 'save')).toBe('冲突提示')
    expect(localFileErrorMessage(new Error('disk full'), 'save')).toBe('保存原文件失败，请重试')
  })
})
