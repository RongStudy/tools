/**
 * Monaco Editor 类型定义
 * 减少 any 类型的使用，提供基本的类型安全
 */
import type * as Monaco from 'monaco-editor'

/** Monaco 单编辑器实例类型 */
export type MonacoEditor = Monaco.editor.IStandaloneCodeEditor

/** Monaco Diff 编辑器实例类型 */
export type MonacoDiffEditor = Monaco.editor.IStandaloneDiffEditor

/** Monaco 编辑器引用类型（可能为 null） */
export type MonacoEditorRef = MonacoEditor | null

/** Monaco Diff 编辑器引用类型（可能为 null） */
export type MonacoDiffEditorRef = MonacoDiffEditor | null

/** Monaco 编辑器变更事件 */
export type MonacoEditorChangeEvent = (value: string | undefined) => void

/** Diff 编辑器行变更类型 */
export interface DiffLineChange {
  originalStartLineNumber: number
  originalEndLineNumber: number
  modifiedStartLineNumber: number
  modifiedEndLineNumber: number
  charChanges: unknown[] | null
}
