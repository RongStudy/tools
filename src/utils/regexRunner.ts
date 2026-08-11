import { evaluateRegex, type RegexTaskInput, type RegexTaskResult } from './regex'

const DEFAULT_TIMEOUT_MS = 1000

type WorkerResponse =
  | { ok: true; result: RegexTaskResult }
  | { ok: false; error: string }

export const runRegexTask = (
  input: RegexTaskInput,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<RegexTaskResult> => {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(evaluateRegex(input))
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/regex.worker.ts', import.meta.url), { type: 'module' })
    const timeout = window.setTimeout(() => {
      worker.terminate()
      reject(new Error(`执行超过 ${timeoutMs}ms，表达式可能存在灾难性回溯`))
    }, timeoutMs)

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      window.clearTimeout(timeout)
      worker.terminate()
      if (event.data.ok) {
        resolve(event.data.result)
      } else {
        reject(new Error(event.data.error))
      }
    }

    worker.onerror = (event) => {
      window.clearTimeout(timeout)
      worker.terminate()
      reject(new Error(event.message || '正则执行失败'))
    }

    worker.postMessage(input)
  })
}
