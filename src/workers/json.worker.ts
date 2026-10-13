import { transformJson, type JsonOperation } from '../utils/jsonText'

self.onmessage = (event: MessageEvent<{ text: string; operation: JsonOperation; indentSize: number }>) => {
  try {
    self.postMessage({ output: transformJson(event.data.text, event.data.operation, event.data.indentSize) })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
