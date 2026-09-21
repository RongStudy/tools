import { clampSplitRatio, DEFAULT_SPLIT_RATIO } from '../hooks/useSplitPane'

export type JsonDocument = {
  id: string
  name: string
  input: string
  output: string
  error: string
  splitRatio: number
}

export const DEFAULT_JSON_DOCUMENT: JsonDocument = {
  id: 'json-1',
  name: 'JSON 1',
  input: '',
  output: '',
  error: '',
  splitRatio: DEFAULT_SPLIT_RATIO,
}

export const createJsonDocument = (documents: JsonDocument[]): JsonDocument => {
  const highestDocumentNumber = documents.reduce((highest, document) => {
    const match = /^JSON (\d+)$/.exec(document.name)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  const nextDocumentNumber = highestDocumentNumber + 1

  return {
    id: `json-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: `JSON ${nextDocumentNumber}`,
    input: '',
    output: '',
    error: '',
    splitRatio: DEFAULT_SPLIT_RATIO,
  }
}

export const normalizeJsonDocument = (value: unknown): JsonDocument | null => {
  if (!value || typeof value !== 'object') return null

  const document = value as Partial<JsonDocument>
  if (typeof document.id !== 'string'
    || typeof document.name !== 'string'
    || typeof document.input !== 'string'
    || typeof document.output !== 'string'
    || typeof document.error !== 'string') {
    return null
  }

  return {
    id: document.id,
    name: document.name,
    input: document.input,
    output: document.output,
    error: document.error,
    splitRatio: typeof document.splitRatio === 'number' && Number.isFinite(document.splitRatio)
      ? clampSplitRatio(document.splitRatio)
      : DEFAULT_SPLIT_RATIO,
  }
}

export const unescapeJson = (value: string): string => {
  let result = value
  let previousResult = ''

  while (result !== previousResult) {
    previousResult = result
    try {
      const parsed = JSON.parse(result)
      if (typeof parsed === 'string') {
        result = parsed
      } else {
        break
      }
    } catch {
      result = result
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\')
    }
  }

  return result
}

export const formatJsonString = (value: string, indentSize: number): string => {
  const jsonValue = JSON.parse(unescapeJson(value.trim()))
  return JSON.stringify(jsonValue, null, indentSize)
}
