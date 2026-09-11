/**
 * 内容格式检测：区分 Mermaid 与 Markdown
 *
 * 纯前端实现。依据 Mermaid 语法规则：所有 Mermaid 图的第一个非空、非注释行
 * 必须是图类型关键字（如 flowchart、sequenceDiagram）。因此：
 * - 跳过空行与注释行（%% 开头）后，首行第一个 token 命中已知关键字 → Mermaid
 * - 其余情况一律视为 Markdown（Mermaid 缺少类型关键字本就无法渲染）
 */

export type ContentFormat = 'mermaid' | 'markdown'

export const MERMAID_DIAGRAM_KEYWORDS = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'classDiagram-v2',
  'stateDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'gantt',
  'pie',
  'journey',
  'mindmap',
  'timeline',
  'gitGraph',
  'quadrantChart',
  'requirementDiagram',
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Dynamic',
  'C4Deployment',
  'sankey-beta',
  'block-beta',
  'xychart-beta',
  'packet-beta',
  'zenuml',
  'kanban',
  'architecture-beta',
  'info',
] as const

const KEYWORD_SET = new Set<string>(MERMAID_DIAGRAM_KEYWORDS)

/**
 * 根据内容判断渲染格式。
 * @returns 'mermaid' | 'markdown'；内容为空或只有注释时返回 null
 */
export const detectFormat = (source: string): ContentFormat | null => {
  for (const line of source.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('%%')) continue

    const firstToken = trimmed.split(/\s+/)[0]
    return KEYWORD_SET.has(firstToken) ? 'mermaid' : 'markdown'
  }

  return null
}
