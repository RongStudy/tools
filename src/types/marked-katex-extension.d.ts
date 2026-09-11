/**
 * marked-katex-extension 类型声明
 *
 * 该包 package.json 的 "types" 指向其源码 src/index.ts（含未使用的参数），
 * 会被项目的 noUnusedParameters 误报。这里通过 tsconfig paths 重映射到本声明文件，
 * 仅影响 tsc 类型检查；运行时 Vite 仍解析真实的 npm 包。
 */
import type { MarkedExtension } from 'marked'

export interface MarkedKatexOptions {
  /** 公式解析失败时是否抛出异常，默认 true */
  throwOnError?: boolean
  /** throwOnError 为 false 时的错误渲染颜色 */
  errorColor?: string
  /**
   * 非标准模式：允许 $ 紧贴前后字符（如中文标点 "公式：$x^2$"）也能解析，
   * 代价是 "$5 and $10" 这类货币文本可能被误判
   */
  nonStandard?: boolean
  [key: string]: unknown
}

declare const markedKatex: (options?: MarkedKatexOptions) => MarkedExtension

export default markedKatex
