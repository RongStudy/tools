import { transformJson, type JsonOperation } from './jsonText'

export const LARGE_JSON_THRESHOLD = 50_000
export const runJsonTask = (text: string, operation: JsonOperation, indentSize: number, signal: AbortSignal): Promise<string> => {
  if (signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'))
  if (typeof Worker === 'undefined') {
    return Promise.resolve().then(() => transformJson(text, operation, indentSize))
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/json.worker.ts', import.meta.url), { type: 'module' })
    const cleanup = () => {
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      worker.terminate()
    }
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')) }
    const timeout = setTimeout(() => { cleanup(); reject(new Error('处理超时，请减少内容后重试')) }, 15_000)
    signal.addEventListener('abort', abort, { once: true })
    worker.onmessage = (event: MessageEvent<{ output?: string; error?: string }>) => {
      cleanup()
      if (event.data.error) reject(new Error(event.data.error))
      else resolve(event.data.output ?? '')
    }
    worker.onerror = () => { cleanup(); reject(new Error('处理失败，请重试')) }
    worker.postMessage({ text, operation, indentSize })
  })
}
