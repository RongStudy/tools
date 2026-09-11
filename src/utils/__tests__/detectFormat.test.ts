import { describe, expect, it } from 'vitest'
import { detectFormat, MERMAID_DIAGRAM_KEYWORDS } from '../detectFormat'

describe('detectFormat', () => {
  it('识别常见 Mermaid 图类型为 mermaid', () => {
    expect(detectFormat('flowchart LR\n  A --> B')).toBe('mermaid')
    expect(detectFormat('graph TD\n  A --> B')).toBe('mermaid')
    expect(detectFormat('sequenceDiagram\n  A->>B: Hello')).toBe('mermaid')
    expect(detectFormat('pie title 占比\n  "A": 1\n  "B": 2')).toBe('mermaid')
  })

  it('跳过空行与 %% 注释行后识别关键字', () => {
    expect(detectFormat('\n\n%% 这是一个注释\nflowchart TD\n  A --> B')).toBe('mermaid')
    expect(detectFormat('%% 只有注释')).toBeNull()
  })

  it('常规文本识别为 markdown', () => {
    expect(detectFormat('# 标题\n\n正文内容')).toBe('markdown')
    expect(detectFormat('| a | b |\n|---|---|')).toBe('markdown')
    expect(detectFormat('$$\\int_0^1 x\\,dx$$')).toBe('markdown')
    expect(detectFormat('- 列表项')).toBe('markdown')
    expect(detectFormat('普通的一段文字')).toBe('markdown')
  })

  it('空内容返回 null', () => {
    expect(detectFormat('')).toBeNull()
    expect(detectFormat('   \n  \n')).toBeNull()
  })

  it('内置关键字表全部命中 mermaid', () => {
    for (const keyword of MERMAID_DIAGRAM_KEYWORDS) {
      expect(detectFormat(`${keyword}\n  content`)).toBe('mermaid')
    }
  })

  it('markdown 内容不会因包含 mermaid 关键字误判', () => {
    // 关键字必须出现在首个有效行，段落中间出现不算
    expect(detectFormat('下面是一个 flowchart 的介绍')).toBe('markdown')
    expect(detectFormat('## flowchart 说明\n\n正文')).toBe('markdown')
  })
})
