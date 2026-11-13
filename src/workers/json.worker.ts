import { transformJson, type JsonOperation } from '../utils/jsonText'
import { setLocale, type Locale } from '../i18n'

self.onmessage = (event: MessageEvent<{ text: string; operation: JsonOperation; indentSize: number; locale?: Locale }>) => {
  setLocale(event.data.locale ?? 'en')
  try {
    self.postMessage({ output: transformJson(event.data.text, event.data.operation, event.data.indentSize) })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
