import { describe, expect, it } from 'vitest'
import {
  formatJsonString,
  normalizeJsonDocument,
  unescapeJson,
} from '../jsonFormatter'

describe('jsonFormatter', () => {
  it('恢复旧草稿时应补充分割比例并限制异常比例', () => {
    const baseDocument = {
      id: 'json-1',
      name: 'JSON 1',
      input: '',
      output: '',
      error: '',
    }

    expect(normalizeJsonDocument(baseDocument)?.splitRatio).toBe(30)
    expect(normalizeJsonDocument({ ...baseDocument, splitRatio: 95 })?.splitRatio).toBe(80)
    expect(normalizeJsonDocument({ ...baseDocument, splitRatio: 5 })?.splitRatio).toBe(20)
  })

  it('应拒绝字段不完整的草稿文档', () => {
    expect(normalizeJsonDocument({ id: 'json-1', name: 'JSON 1' })).toBeNull()
  })

  it('应格式化多层转义的 JSON 字符串', () => {
    const escaped = JSON.stringify(JSON.stringify({ name: 'tool' }))

    expect(unescapeJson(escaped)).toBe('{"name":"tool"}')
    expect(formatJsonString(escaped, 2)).toBe('{\n  "name": "tool"\n}')
  })
})
