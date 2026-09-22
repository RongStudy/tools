import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import type { MonacoSetup } from './types'

/**
 * Manifest V3 禁止远程执行代码，Monaco 本体与各语言 Worker 必须打进扩展包。
 * 这段配置在模块求值时执行，早于任何编辑器组件挂载。
 */
self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') return new JsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()
    if (label === 'typescript' || label === 'javascript') return new TsWorker()

    return new EditorWorker()
  },
}

loader.config({ monaco })

/** 本地实例已在上方注入 loader，这里无需再从 CDN 拉取 */
export const setupMonaco: MonacoSetup = () => {
  void loader.init()
}
