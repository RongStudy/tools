import { describe, expect, it } from 'vitest'
import { evaluateRegex, normalizeRegexFlags } from '../regex'

const run = (overrides: Partial<Parameters<typeof evaluateRegex>[0]> = {}) => evaluateRegex({
  pattern: '(?<word>\\w+)',
  flags: 'dg',
  text: 'one two',
  replacement: '[$<word>]',
  splitLimit: 100,
  ...overrides,
})

describe('evaluateRegex', () => {
  it('返回全局匹配、编号分组、命名分组和索引', () => {
    const result = run()

    expect(result.matches).toHaveLength(2)
    expect(result.matches[0]).toMatchObject({
      value: 'one',
      index: 0,
      end: 3,
      groups: ['one'],
      namedGroups: { word: 'one' },
      groupIndices: [[0, 3]],
      namedGroupIndices: { word: [0, 3] },
    })
  })

  it('没有 g 标志时只返回并替换第一个匹配', () => {
    const result = run({ flags: '', pattern: '\\w+', replacement: 'X' })

    expect(result.matches.map((match) => match.value)).toEqual(['one'])
    expect(result.replacement).toBe('X two')
  })

  it('正确推进全局零宽匹配', () => {
    const result = run({ pattern: '(?=a)', flags: 'g', text: 'aaa', maxMatches: 10 })

    expect(result.matches.map((match) => match.index)).toEqual([0, 1, 2])
  })

  it('限制匹配和分割结果数量', () => {
    const result = run({ pattern: '.', flags: 'g', text: 'abcdef', maxMatches: 3, splitLimit: 2 })

    expect(result.matches).toHaveLength(3)
    expect(result.truncated).toBe(true)
    expect(result.splitItems).toHaveLength(2)
  })

  it('支持命名组替换', () => {
    expect(run().replacement).toBe('[one] [two]')
  })
})

describe('normalizeRegexFlags', () => {
  it('去重并按规范顺序排列 flags', () => {
    expect(normalizeRegexFlags(['i', 'g', 'd', 'g'])).toBe('dgi')
  })
})
