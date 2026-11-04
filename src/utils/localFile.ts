export type LocalFileHandle = {
  getFile: () => Promise<File>
  createWritable: () => Promise<{ write: (content: Uint8Array) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> }>
}

type FilePickerWindow = Window & { showOpenFilePicker?: () => Promise<LocalFileHandle[]> }

export const supportsFileWriteback = () => typeof (window as FilePickerWindow).showOpenFilePicker === 'function'

export class LocalFileError extends Error {
  constructor(public readonly code: 'encoding' | 'conflict', message: string) {
    super(message)
    this.name = 'LocalFileError'
  }
}

export type OpenLocalFile = {
  handle: LocalFileHandle
  name: string
  content: string
  bytes: Uint8Array
  hasBom: boolean
}

export const openWritableFile = async () => {
  const [handle] = await (window as FilePickerWindow).showOpenFilePicker!()
  const file = await handle.getFile()
  const bytes = new Uint8Array(await file.arrayBuffer())
  let content: string
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (content.includes('\0')) throw new Error('Binary content')
  } catch {
    throw new LocalFileError('encoding', '写回仅支持 UTF-8 文本，请先转换文件编码，或关闭写回后查看')
  }
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  return { handle, name: file.name, content, bytes, hasBom }
}

export const writeLocalFile = async (opened: OpenLocalFile, content: string) => {
  if (opened.content === content) return opened
  const writable = await opened.handle.createWritable()
  try {
    const current = await opened.handle.getFile()
    const currentBytes = new Uint8Array(await current.arrayBuffer())
    if (currentBytes.length !== opened.bytes.length || currentBytes.some((byte, index) => byte !== opened.bytes[index])) {
      throw new LocalFileError('conflict', '文件已在外部修改，请重新加载后再保存')
    }
    const bytes = new TextEncoder().encode(`${opened.hasBom ? '\ufeff' : ''}${content}`)
    await writable.write(bytes)
    await writable.close()
    return { ...opened, content, bytes }
  } catch (error) {
    await writable.abort().catch(() => {})
    throw error
  }
}

const errorName = (error: unknown) => typeof error === 'object' && error !== null && 'name' in error ? error.name : undefined

export const isFilePickerCancelled = (error: unknown) => errorName(error) === 'AbortError'

export const localFileErrorMessage = (error: unknown, action: 'load' | 'save') => {
  if (error instanceof LocalFileError) return error.message
  if (errorName(error) === 'NotAllowedError' || errorName(error) === 'SecurityError') {
    return '文件访问未获授权，请重新选择文件并允许访问'
  }
  return action === 'load' ? '加载文件失败，请重试' : '保存原文件失败，请重试'
}
