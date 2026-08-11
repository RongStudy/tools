/// <reference lib="webworker" />

import { evaluateRegex, type RegexTaskInput } from '../utils/regex'

self.onmessage = (event: MessageEvent<RegexTaskInput>) => {
  try {
    self.postMessage({ ok: true, result: evaluateRegex(event.data) })
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export {}
