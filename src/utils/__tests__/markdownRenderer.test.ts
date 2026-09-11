import { describe, expect, it } from 'vitest'
import {
  getMermaidBlockSource,
  markdownExportBaseStyles,
  renderMarkdown,
  DEFAULT_MARKDOWN_CODE,
} from '../markdownRenderer'

describe('renderMarkdown', () => {
  it('渲染标题与列表', () => {
    const html = renderMarkdown('# 标题\n\n- 一\n- 二')
    expect(html).toContain('<h1')
    expect(html).toContain('<li>一</li>')
    expect(html).toContain('<li>二</li>')
  })

  it('渲染 GFM 表格', () => {
    const html = renderMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>a</th>')
    expect(html).toContain('<td>1</td>')
  })

  it('渲染行内与块级 LaTeX 公式', () => {
    const html = renderMarkdown('行内公式：$E = mc^2$\n\n$$\n\\int_0^1 x\\,dx\n$$')
    expect(html).toContain('class="katex"')
    expect(html).toContain('katex-display')
  })

  it('代码块语法高亮', () => {
    const html = renderMarkdown('```ts\nconst a: number = 1\n```')
    expect(html).toContain('hljs')
    expect(html).toContain('language-ts')
  })

  it('移除危险 HTML', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n**safe**')
    expect(html).not.toContain('<script')
    expect(html).toContain('<strong>safe</strong>')
  })

  it('mermaid 代码块输出占位容器，源码存于模块暂存区', () => {
    const source = 'flowchart LR\n  A --> B\n  B --> C'
    const html = renderMarkdown('```mermaid\n' + source + '\n```')
    expect(html).toContain('mermaid-block')
    expect(html).toContain('正在渲染图表')

    // 从占位容器 id 反查暂存区中的原始源码（未被 DOMPurify 剥离）
    const idMatch = html.match(/id="(mmb-\d+)"/)
    expect(idMatch).not.toBeNull()
    expect(getMermaidBlockSource(idMatch![1])).toBe(source)
    expect(html).not.toContain('language-mermaid')
  })

  it('默认示例包含各类型内容且可渲染', () => {
    const html = renderMarkdown(DEFAULT_MARKDOWN_CODE)
    expect(html).toContain('<h1')
    expect(html).toContain('<table>')
    expect(html).toContain('katex')
    expect(html).toContain('hljs')
  })

  it('导出基础样式随预览布局变化', () => {
    // 铺满：无最大宽度、从左起
    expect(markdownExportBaseStyles('full')).toContain('max-width:none')
    expect(markdownExportBaseStyles('full')).toContain('margin:0;')
    // 居中：限制最大宽度并水平居中
    expect(markdownExportBaseStyles('centered')).toContain('max-width:52rem')
    expect(markdownExportBaseStyles('centered')).toContain('margin:0 auto')
  })
})
