import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/editor'
import 'monaco-editor/features/register.all'
import 'monaco-editor/languages/definitions/register.all'
import 'monaco-editor/languages/features/register.all'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/languages/features/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/languages/features/html/html.worker?worker'
import JsonWorker from 'monaco-editor/languages/features/json/json.worker?worker'
import TsWorker from 'monaco-editor/languages/features/typescript/ts.worker?worker'
import { configureBuiltinLanguageServices } from './languageServices'
import { registerMermaidLanguage } from './mermaid'

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') return new JsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()
    if (label === 'typescript' || label === 'javascript') return new TsWorker()
    return new EditorWorker()
  },
}

configureBuiltinLanguageServices()
registerMermaidLanguage(monaco)
// Cmd/Ctrl+K belongs to tool search, so the default K → F chord cannot reach Monaco.
monaco.editor.addKeybindingRules([
  {
    keybinding: monaco.KeyMod.chord(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF),
    command: '-editor.action.formatSelection',
  },
  {
    keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
    command: 'editor.action.formatSelection',
    when: 'editorTextFocus && !editorReadonly && editorHasDocumentSelectionFormattingProvider',
  },
])
loader.config({ monaco })

export const initializeMonaco = () => loader.init().then(() => undefined)
