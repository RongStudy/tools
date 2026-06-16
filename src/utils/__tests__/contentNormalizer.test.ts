import { describe, it, expect } from 'vitest'
import { normalizeIndent, cleanFileContent } from '../contentNormalizer'

describe('normalizeIndent', () => {
  it('应将4空格缩进规范化为2空格缩进', () => {
    const input = `function hello() {
    console.log("hello");
    if (true) {
        console.log("nested");
    }
}`
    const result = normalizeIndent(input)
    // 基础缩进为4，应转换为2
    expect(result).toContain('  console.log')  // 2空格
    expect(result).toContain('    console.log("nested")')  // 4空格（原8空格/2）
  })

  it('应保持2空格缩进不变', () => {
    const input = `function hello() {
  console.log("hello");
}`
    const result = normalizeIndent(input)
    expect(result).toBe(input)
  })

  it('应处理制表符缩进', () => {
    const input = `function hello() {
\tconsole.log("hello");
}`
    const result = normalizeIndent(input)
    expect(result).toContain('  console.log')  // 制表符转为2空格
  })

  it('应保留空行', () => {
    const input = `line1

line2`
    const result = normalizeIndent(input)
    expect(result).toContain('\n\n')
  })

  it('应处理无缩进的内容', () => {
    const input = 'no indent here'
    const result = normalizeIndent(input)
    expect(result).toBe(input)
  })
})

describe('cleanFileContent', () => {
  it('应移除 BOM', () => {
    const bom = '\uFEFF'
    const input = `${bom}{"key": "value"}`
    const result = cleanFileContent(input)
    expect(result).not.toContain('\uFEFF')
    expect(result).toContain('{"key": "value"}')
  })

  it('应规范化 Windows 行尾符 (CRLF -> LF)', () => {
    const input = 'line1\r\nline2\r\nline3'
    const result = cleanFileContent(input)
    expect(result).not.toContain('\r\n')
    expect(result).toContain('\n')
    expect(result.split('\n')).toHaveLength(3)
  })

  it('应规范化旧 Mac 行尾符 (CR -> LF)', () => {
    const input = 'line1\rline2\rline3'
    const result = cleanFileContent(input)
    expect(result).not.toContain('\r')
    expect(result.split('\n')).toHaveLength(3)
  })

  it('应移除每行末尾的空白字符', () => {
    const input = 'line1   \nline2\t\nline3  '
    const result = cleanFileContent(input)
    const lines = result.split('\n')
    expect(lines[0]).toBe('line1')
    expect(lines[1]).toBe('line2')
  })

  it('应移除文件末尾的连续空行', () => {
    const input = 'line1\nline2\n\n\n'
    const result = cleanFileContent(input)
    expect(result.endsWith('\n')).toBe(true)
    expect(result.endsWith('\n\n\n')).toBe(false)
  })

  it('应对空字符串返回空字符串', () => {
    expect(cleanFileContent('')).toBe('')
  })

  it('应对仅含空白的内容返回空字符串', () => {
    expect(cleanFileContent('   \n  \n  ')).toBe('')
  })

  it('应综合处理多种问题', () => {
    const input = '\uFEFF{"key": "value"}\r\n{"key2": "value2"}   \n\n\n'
    const result = cleanFileContent(input)
    expect(result).not.toContain('\uFEFF')
    expect(result).not.toContain('\r')
    expect(result).not.toContain('   ')
    expect(result.endsWith('\n\n\n')).toBe(false)
  })
})
