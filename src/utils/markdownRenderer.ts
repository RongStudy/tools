/**
 * Markdown 渲染模块（纯前端）
 *
 * - marked 16 + marked-katex-extension 5.x：GFM（表格/删除线/任务列表/自动链接）+ LaTeX 数学公式
 * - 使用私有 Marked 实例，避免 katex 扩展污染全局 marked（mermaid 内部也使用 marked 渲染节点标签）
 * - highlight.js：围栏代码块语法高亮
 * - DOMPurify：渲染结果消毒后再注入 DOM
 */
import { Marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import hljs from 'highlight.js/lib/common'
import DOMPurify from 'dompurify'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark.css'
import katexCss from 'katex/dist/katex.min.css?inline'
import hljsThemeCss from 'highlight.js/styles/github-dark.css?inline'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * mermaid 代码块源码暂存区。
 * 占位容器只携带自增 id（避免把源码放进 data-* 属性——DOMPurify 会剥离
 * 值中包含 "-->" 的属性），组件在 DOM 注入后按 id 取源码异步渲染。
 */
const mermaidBlockSources = new Map<string, string>()
let mermaidBlockId = 0
const MERMAID_BLOCK_SOURCE_CAP = 512

export const getMermaidBlockSource = (id: string): string | undefined => (
  mermaidBlockSources.get(id)
)

export const removeMermaidBlockSource = (id: string): void => {
  mermaidBlockSources.delete(id)
}

const markdown = new Marked({ gfm: true, breaks: true })

markdown.use(
  markedKatex({
    throwOnError: false,
    errorColor: '#f87171',
    // nonStandard: 允许 $ 紧贴中文标点（如 "公式：$x^2$"）时也能解析行内公式
    nonStandard: true,
  })
)

markdown.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = (lang || '').trim().split(/\s+/)[0]

      // mermaid 代码块：输出占位容器，组件在 DOM 注入后按 id 取源码异步渲染为 SVG
      if (language === 'mermaid') {
        const id = `mmb-${++mermaidBlockId}`
        mermaidBlockSources.set(id, text)
        if (mermaidBlockSources.size > MERMAID_BLOCK_SOURCE_CAP) {
          const oldest = mermaidBlockSources.keys().next().value
          if (oldest !== undefined) mermaidBlockSources.delete(oldest)
        }
        return (
          `<div class="mermaid-block" id="${id}">` +
          '<div class="mermaid-block-loading">正在渲染图表...</div></div>'
        )
      }

      if (language && hljs.getLanguage(language)) {
        const highlighted = hljs.highlight(text, { language, ignoreIllegals: true }).value
        return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
      }

      return `<pre><code class="hljs">${escapeHtml(text)}</code></pre>`
    },
  },
})

/** 渲染 Markdown 为已消毒的 HTML 字符串 */
export const renderMarkdown = (source: string): string => {
  const rawHtml = markdown.parse(source) as string
  return DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } })
}

/** Markdown 预览布局：铺满（从左起）或居中 */
export type MarkdownLayout = 'full' | 'centered'

/** 导出独立 HTML 时需内联的样式（KaTeX 字体与代码高亮主题） */
export const MARKDOWN_EXPORT_STYLES = `${katexCss}\n${hljsThemeCss}`

/** 导出独立 HTML 时的基础排版样式，随当前预览布局生成（与显示格式保持一致） */
export const markdownExportBaseStyles = (layout: MarkdownLayout): string => `
.markdown-export-body{margin:0;background:#ffffff;color:#1f2328;font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;}
.markdown-export-main{max-width:${layout === 'centered' ? '52rem' : 'none'};margin:${layout === 'centered' ? '0 auto' : '0'};padding:2rem 1.5rem;}
.markdown-export-main h1,.markdown-export-main h2,.markdown-export-main h3{line-height:1.3;border-bottom:1px solid #d8dee4;padding-bottom:.3em;}
.markdown-export-main pre{background:#0d1117;color:#e6edf3;padding:1rem;border-radius:8px;overflow:auto;}
.markdown-export-main code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
.markdown-export-main table{border-collapse:collapse;}
.markdown-export-main th,.markdown-export-main td{border:1px solid #d8dee4;padding:.4rem .7rem;}
.markdown-export-main blockquote{margin:1em 0;padding:.2em 1em;border-left:3px solid #5e6ad2;color:#57606a;background:#f6f8fa;}
.markdown-export-main img{max-width:100%;}
.markdown-export-main .katex-block{overflow-x:auto;overflow-y:hidden;}
`

export const DEFAULT_MARKDOWN_CODE = [
  '# Markdown 渲染示例',
  '',
  '支持 **粗体**、*斜体*、~~删除线~~、`行内代码` 与 [链接](https://example.com)。',
  '',
  '## 数学公式（LaTeX）',
  '',
  '行内公式：$E = mc^2$，以及 $\\int_0^1 x^2 \\, dx$。',
  '',
  '块级公式：',
  '',
  '$$',
  '\\int_{-\\infty}^{+\\infty} e^{-x^2} dx = \\sqrt{\\pi}',
  '$$',
  '',
  '## GFM 表格与任务列表',
  '',
  '| 功能 | 支持 |',
  '| --- | --- |',
  '| GFM 表格 | ✅ |',
  '| 任务列表 | ✅ |',
  '',
  '- [x] 已完成事项',
  '- [ ] 待办事项',
  '',
  '## 代码高亮',
  '',
  '```ts',
  'const greet = (name: string): string => `Hello, ${name}!`',
  '```',
  '',
  '## Mermaid 图表（内嵌于 Markdown）',
  '',
  '```mermaid',
  'flowchart LR',
  '  A[开始] --> B{是否完成?}',
  '  B -->|是| C[结束]',
  '  B -->|否| A',
  '```',
  '',
  '> 引用块同样支持。',
].join('\n')
