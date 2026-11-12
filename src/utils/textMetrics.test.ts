import { describe, expect, it } from 'vitest'
import { describeSizeChange, formatByteSize, getTextMetrics } from './textMetrics'

describe('text metrics', () => {
  it('counts UTF-8 bytes including Chinese and emoji, and accepts every newline convention', () => {
    expect(getTextMetrics('中😀\r\na\rb\n')).toEqual({ bytes: 13, lines: 4 })
    expect(getTextMetrics('')).toEqual({ bytes: 0, lines: 0 })
  })

  it('formats payload sizes and describes growth as well as compression', () => {
    expect(formatByteSize(10)).toBe('10 B')
    expect(formatByteSize(1434)).toBe('1.4 KB')
    expect(formatByteSize(1024 * 1024)).toBe('1.0 MB')
    expect(describeSizeChange(100, 150)).toBe('较输入增加 50.0%')
    expect(describeSizeChange(100, 70)).toBe('较输入减少 30.0%')
    expect(describeSizeChange(100, 100)).toBe('与输入等大')
    expect(describeSizeChange(0, 0)).toBe('')
  })
})
