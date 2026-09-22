import { loader } from '@monaco-editor/react'
import type { MonacoSetup } from './types'

/**
 * Web target 继续使用 @monaco-editor/react 的 CDN loader，
 * 避免把完整 Monaco 及其语言 Worker 打进 Web 产物。
 */
export const setupMonaco: MonacoSetup = () => {
  void loader.init()
}
