import { createScanner, visit, printParseErrorCode, format, applyEdits } from 'jsonc-parser'

const validate = (text: string) => {
  let error = ''
  visit(text, {
    onError: (code, offset) => { error ||= `${printParseErrorCode(code)} (位置 ${offset + 1})` },
  }, { disallowComments: true, allowTrailingComma: false })
  if (error) throw new Error(error)
}

export const unescapeJson = (value: string): string => {
  let result = value
  // Decode string wrappers only; never convert number tokens to JS numbers.
  for (let depth = 0; depth < 64; depth++) {
    try {
      validate(result)
      if (!result.trim().startsWith('"')) return result
      const decoded: unknown = JSON.parse(result)
      if (typeof decoded !== 'string' || decoded === result) return result
      result = decoded
    } catch {
      const decoded = result
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\')
      if (decoded === result) return result
      result = decoded
    }
  }
  return result
}

export const formatJsonString = (value: string, indentSize: number): string => {
  const text = unescapeJson(value.trim())
  validate(text)
  const spaces = Math.max(0, Math.min(10, indentSize))
  if (spaces) return applyEdits(text, format(text, undefined, { insertSpaces: true, tabSize: spaces, eol: '\n' }))
  const scanner = createScanner(text, true)
  const parts: string[] = []
  for (scanner.scan(); scanner.getTokenLength() > 0; scanner.scan()) {
    parts.push(text.slice(scanner.getTokenOffset(), scanner.getTokenOffset() + scanner.getTokenLength()))
  }
  return parts.join('')
}

export type JsonOperation = 'format' | 'compress' | 'escape' | 'unescape'
export const transformJson = (text: string, operation: JsonOperation, indentSize: number): string => {
  if (!text.trim()) return ''
  if (operation === 'escape') return JSON.stringify(text.trim())
  if (operation === 'unescape') return unescapeJson(text.trim())
  return formatJsonString(text, operation === 'compress' ? 0 : indentSize)
}
