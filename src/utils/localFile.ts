import { t } from '../i18n'
export type LocalFileHandle = {
  getFile: () => Promise<File>
  createWritable: () => Promise<{ write: (content: Uint8Array<ArrayBuffer>) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> }>
}

type FilePickerOptions = {
  types: { accept: Record<string, string[]> }[]
}

type FilePickerWindow = Window & { showOpenFilePicker?: (options?: FilePickerOptions) => Promise<LocalFileHandle[]> }
type FileDropItem = DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> }

export const supportsFileWriteback = () => typeof (window as FilePickerWindow).showOpenFilePicker === 'function'

export class LocalFileError extends Error {
  constructor(public readonly code: 'conflict', message: string) {
    super(message)
    this.name = 'LocalFileError'
  }
}

export type LoadedTextFile = {
  name: string
  content: string
}

export type OpenLocalFile = LoadedTextFile & {
  handle: LocalFileHandle
  bytes: Uint8Array
  hasBom: boolean
}

export const readLocalFile = async (handle: LocalFileHandle): Promise<LoadedTextFile | OpenLocalFile> => {
  const file = await handle.getFile()
  const bytes = new Uint8Array(await file.arrayBuffer())
  let content: string
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return { name: file.name, content: new TextDecoder().decode(bytes) }
  }
  if (content.includes('\0')) return { name: file.name, content }
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  return { handle, name: file.name, content, bytes, hasBom }
}

export const openLocalFile = async (options?: FilePickerOptions) => {
  const [handle] = await (window as FilePickerWindow).showOpenFilePicker!(options)
  return readLocalFile(handle)
}

export const getDroppedFileHandle = async (item?: DataTransferItem) => {
  try {
    const handle = await (item as FileDropItem | undefined)?.getAsFileSystemHandle?.()
    if (handle?.kind === 'file' && typeof (handle as FileSystemFileHandle).createWritable === 'function') {
      return handle as FileSystemFileHandle
    }
  } catch {
    // Some browsers expose the dropped file without granting access to its handle.
  }
  return null
}

export const writeLocalFile = async (opened: OpenLocalFile, content: string) => {
  if (opened.content === content) return opened
  const writable = await opened.handle.createWritable()
  try {
    const current = await opened.handle.getFile()
    const currentBytes = new Uint8Array(await current.arrayBuffer())
    if (currentBytes.length !== opened.bytes.length || currentBytes.some((byte, index) => byte !== opened.bytes[index])) {
      throw new LocalFileError('conflict', t("文件已在外部修改，请重新加载后再保存"))
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
    return t("文件访问未获授权，请重新选择文件并允许访问")
  }
  return action === 'load' ? t("加载文件失败，请重试") : t("保存原文件失败，请重试")
}
