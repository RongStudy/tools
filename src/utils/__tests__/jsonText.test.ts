import { describe, expect, it } from 'vitest'
import { formatJsonString, transformJson, unescapeJson } from '../jsonText'

describe('lossless JSON transformations', () => {
  const source = '{"id":9007199254740993,"decimal":0.123456789012345678901,"exponent":1.2300e+1000,"zero":-0,"text":"a  b\\n\\"c","duplicate":1,"duplicate":2}'
  it('preserves numeric lexemes, string escapes and duplicate keys through format/compress', () => {
    const formatted = formatJsonString(source, 4)
    expect(formatted).toContain('    "id": 9007199254740993')
    expect(transformJson(formatted, 'compress', 2)).toBe(source)
    expect(formatJsonString(source, 0)).toBe(source)
  })
  it('unwraps nested escaped JSON without changing its numbers', () => {
    expect(unescapeJson(JSON.stringify(JSON.stringify(source)))).toBe(source)
    expect(transformJson(JSON.stringify(source), 'compress', 2)).toBe(source)
  })
  it.each(['{"a":1,}', '{/*comment*/"a":1}', '{"a":01}', '[1] [2]', '{"a":"bad\nstring"}', '[NaN]'])('rejects invalid strict JSON: %s', (source) => {
    expect(() => formatJsonString(source, 2)).toThrow()
  })
  it('formats empty containers and primitive roots', () => {
    expect(formatJsonString('{"a":[],"b":{}}', 2)).toBe('{\n  "a": [],\n  "b": {}\n}')
    expect(formatJsonString('-0', 2)).toBe('-0')
    expect(formatJsonString('true', 2)).toBe('true')
  })
})
