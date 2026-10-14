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

  it('注释中的 Mermaid 箭头不会提前结束隐藏模板', () => {
    const html = renderMarkdown([
      '# 正式正文',
      '',
      '<!-- 以下为模板骨架，不构成正文。',
      '',
      '## 隐藏模板',
      '',
      '```mermaid',
      'flowchart LR',
      '  A["触发条件"] --> B["用户动作"]',
      '  B --> C{"业务判断"}',
      '```',
      '',
      '## 隐藏验收表',
      '',
      '| 验收 ID | Given |',
      '| --- | --- |',
      '| AC-001 | `<条件>` |',
      '-->',
      '',
      '## 后续正文',
    ].join('\n'))
    const preview = document.createElement('div')
    preview.innerHTML = html
    expect(preview.textContent).toBe('正式正文\n后续正文\n')
    expect(preview.querySelector('pre, table, .mermaid-block')).toBeNull()
  })

  it('保持普通、行内和连续注释的结束位置', () => {
    const html = renderMarkdown([
      '<!-- 注释一 -->',
      '',
      '正文 <!-- 行内注释 --> 保留',
      '',
      '<!-- 多行注释',
      '在这里结束 -->',
      '',
      '**后续内容**',
      '',
      '<!-- 注释二 -->',
    ].join('\n'))
    expect(html).toContain('正文  保留')
    expect(html).toContain('<strong>后续内容</strong>')
    expect(html).not.toContain('注释')
  })

  it.each(['```', '~~~~'])('注释中的 %s 围栏保留箭头，较短围栏不结束代码块', (fence) => {
    const html = renderMarkdown([
      '<!-- 隐藏模板',
      `${fence}mermaid`,
      'A --> B',
      fence[0].repeat(fence.length - 1),
      'B --> C',
      fence,
      '隐藏文字',
      '-->',
      '',
      '保留正文',
    ].join('\n'))
    expect(html).toBe('<p>保留正文</p>\n')
  })

  it('代码示例中的 HTML 注释保持为代码，不被隐藏', () => {
    const html = renderMarkdown('```text\n<!-- 示例\nA --> B\n-->\n```\n\n`<!-- 行内代码 -->`')
    expect(html).toContain('&lt;!-- 示例')
    expect(html).toContain('A --&gt; B')
    expect(html).toContain('<code>&lt;!-- 行内代码 --&gt;</code>')
  })

  it('未闭合注释隐藏至文档末尾，独立结束符可关闭未闭合围栏', () => {
    expect(renderMarkdown('# 正文\n\n<!-- 隐藏\n```mermaid\nA --> B')).toBe('<h1>正文</h1>\n')
    expect(renderMarkdown('<!-- 隐藏\n```mermaid\nA --> B\n-->\n\n保留')).toBe('<p>保留</p>\n')
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
