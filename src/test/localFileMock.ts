import { vi } from 'vitest'
import type { LocalFileHandle } from '../utils/localFile'

export function memoryLocalFile(name: string, initial: string | Uint8Array) {
  let disk = typeof initial === 'string' ? new TextEncoder().encode(initial) : initial.slice()
  let staged = disk.slice()
  const write = vi.fn(async (bytes: Uint8Array) => { staged = bytes.slice() })
  const close = vi.fn(async () => { disk = staged.slice() })
  const abort = vi.fn(async () => {})
  const handle: LocalFileHandle = {
    getFile: vi.fn(async () => new File([new Uint8Array(disk).buffer], name)),
    createWritable: vi.fn(async () => ({ write, close, abort })),
  }
  return {
    handle, write, close, abort,
    get bytes() { return disk.slice() },
    get text() { return new TextDecoder().decode(disk) },
    setDisk: (value: string | Uint8Array) => { disk = typeof value === 'string' ? new TextEncoder().encode(value) : value.slice() },
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise })
  return { promise, resolve, reject }
}
