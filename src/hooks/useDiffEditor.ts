import { useRef, useEffect, useCallback, useState } from 'react'
import type { MonacoDiffEditor, MonacoEditor, DiffLineChange } from '../types/monaco'

type DiffSide = 'original' | 'modified'

/**
 * DiffEditor 管理 Hook
 * 封装 Monaco DiffEditor 的可编辑强制设置、事件监听、差异导航等功能
 * 修复了原实现中的内存泄漏和闭包问题
 */
export function useDiffEditor() {
  const diffEditorRef = useRef<MonacoDiffEditor | null>(null)
  const isUnmountingRef = useRef(false)
  const disposablesRef = useRef<Array<{ dispose: () => void }>>([])
  const callbacksRef = useRef<{
    onOriginalChange?: (value: string) => void
    onModifiedChange?: (value: string) => void
  }>({})
  const cursorRestoreTokenRef = useRef<Record<DiffSide, number>>({
    original: 0,
    modified: 0,
  })
  const [diffCount, setDiffCount] = useState(0)

  /** 强制设置编辑器为可编辑 */
  const forceEditable = useCallback((editor: MonacoDiffEditor) => {
    if (!editor || isUnmountingRef.current) return

    try {
      const originalEditor = editor.getOriginalEditor()
      const modifiedEditor = editor.getModifiedEditor()

      if (!originalEditor || !modifiedEditor) return
      if (!originalEditor.getModel() || !modifiedEditor.getModel()) return

      originalEditor.updateOptions({
        readOnly: false,
        wordWrap: 'on',
        wrappingIndent: 'same',
      })
      modifiedEditor.updateOptions({
        readOnly: false,
        wordWrap: 'on',
        wrappingIndent: 'same',
      })
    } catch {
      // 编辑器可能已被销毁，忽略错误
    }
  }, [])

  /** 同步当前差异数量到 React 状态 */
  const updateDiffCount = useCallback((editor: MonacoDiffEditor) => {
    if (!editor || isUnmountingRef.current) return

    try {
      const lineChanges = editor.getLineChanges()
      setDiffCount(lineChanges ? lineChanges.length : 0)
    } catch {
      setDiffCount(0)
    }
  }, [])

  /** 根据左右 editor 的非内容区宽度修正默认分栏比例，让左右内容区初始等宽 */
  const equalizeContentWidths = useCallback((editor: MonacoDiffEditor) => {
    if (!editor || isUnmountingRef.current) return

    try {
      const containerWidth = editor.getContainerDomNode().getBoundingClientRect().width
      if (containerWidth <= 0) return

      const originalLayout = editor.getOriginalEditor().getLayoutInfo()
      const modifiedLayout = editor.getModifiedEditor().getLayoutInfo()
      const overviewWidth = Math.max(0, containerWidth - originalLayout.width - modifiedLayout.width)
      const originalChromeWidth = originalLayout.width - originalLayout.contentWidth
      const modifiedChromeWidth = modifiedLayout.width - modifiedLayout.contentWidth
      const desiredOriginalWidth = (containerWidth - overviewWidth + originalChromeWidth - modifiedChromeWidth) / 2
      const nextRatio = Math.min(0.9, Math.max(0.1, desiredOriginalWidth / containerWidth))

      if (!Number.isFinite(nextRatio)) return
      editor.updateOptions({ splitViewDefaultRatio: nextRatio })
      editor.layout()
    } catch {
      // 布局信息在 Monaco 初始化早期可能暂不可用，忽略即可。
    }
  }, [])

  /** 更新编辑器内容变化回调，避免 DiffEditor 不重建时闭包过期 */
  const setEditorCallbacks = useCallback((callbacks: {
    onOriginalChange?: (value: string) => void
    onModifiedChange?: (value: string) => void
  }) => {
    callbacksRef.current = callbacks
  }, [])

  /** React 状态回写 DiffEditor 后，恢复用户编辑产生的光标和滚动位置 */
  const restoreCursorAfterChange = useCallback((codeEditor: MonacoEditor, side: DiffSide) => {
    if (!codeEditor || isUnmountingRef.current) return

    try {
      if (!codeEditor.getModel()) return
      if (typeof codeEditor.hasTextFocus === 'function' && !codeEditor.hasTextFocus()) return

      const selection = codeEditor.getSelection()
      if (!selection) return

      const scrollTop = codeEditor.getScrollTop()
      const scrollLeft = codeEditor.getScrollLeft()
      const restoreToken = cursorRestoreTokenRef.current[side] + 1
      cursorRestoreTokenRef.current[side] = restoreToken

      const restore = () => {
        if (isUnmountingRef.current || cursorRestoreTokenRef.current[side] !== restoreToken) return

        try {
          if (!codeEditor.getModel()) return
          codeEditor.setSelection(selection)
          codeEditor.setScrollTop(scrollTop)
          codeEditor.setScrollLeft(scrollLeft)
        } catch {
          // 编辑器可能已被销毁，忽略错误
        }
      }

      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(restore)
      } else {
        window.setTimeout(restore, 0)
      }
    } catch {
      // 某些 Monaco 初始化阶段 API 可能暂不可用，忽略即可。
    }
  }, [])

  /** 设置编辑器内容变化监听器 */
  const setupEditorListeners = useCallback((editor: MonacoDiffEditor) => {
    if (!editor || isUnmountingRef.current) return

    try {
      // 先清理之前的监听器
      disposablesRef.current.forEach(disposable => {
        try { disposable.dispose() } catch { /* 忽略 */ }
      })
      disposablesRef.current = []

      const modifiedEditor = editor.getModifiedEditor()
      const originalEditor = editor.getOriginalEditor()

      // 立即强制设置为可编辑
      forceEditable(editor)

      // 延迟一次确保生效（减少原实现中的多次定时器）
      const timer = setTimeout(() => {
        if (!isUnmountingRef.current) {
          forceEditable(editor)
          updateDiffCount(editor)
          equalizeContentWidths(editor)
        }
      }, 100)

      // 监听修改后的编辑器内容变化
      const modifiedContentDisposable = modifiedEditor.onDidChangeModelContent(() => {
        if (isUnmountingRef.current) return
        try {
          if (!modifiedEditor.getModel()) return
          const newCode = modifiedEditor.getValue()
          restoreCursorAfterChange(modifiedEditor, 'modified')
          callbacksRef.current.onModifiedChange?.(newCode)
          forceEditable(editor)
        } catch { /* 忽略 */ }
      })
      disposablesRef.current.push(modifiedContentDisposable)

      // 监听原始编辑器内容变化
      const originalContentDisposable = originalEditor.onDidChangeModelContent(() => {
        if (isUnmountingRef.current) return
        try {
          if (!originalEditor.getModel()) return
          const newCode = originalEditor.getValue()
          restoreCursorAfterChange(originalEditor, 'original')
          callbacksRef.current.onOriginalChange?.(newCode)
          forceEditable(editor)
        } catch { /* 忽略 */ }
      })
      disposablesRef.current.push(originalContentDisposable)

      // 监听编辑器获得焦点时确保可编辑
      const originalFocusDisposable = originalEditor.onDidFocusEditorText(() => {
        if (!isUnmountingRef.current) forceEditable(editor)
      })
      disposablesRef.current.push(originalFocusDisposable)

      const modifiedFocusDisposable = modifiedEditor.onDidFocusEditorText(() => {
        if (!isUnmountingRef.current) forceEditable(editor)
      })
      disposablesRef.current.push(modifiedFocusDisposable)

      const diffUpdateDisposable = editor.onDidUpdateDiff(() => {
        updateDiffCount(editor)
        equalizeContentWidths(editor)
      })
      disposablesRef.current.push(diffUpdateDisposable)

      updateDiffCount(editor)
      equalizeContentWidths(editor)

      const handleResize = () => equalizeContentWidths(editor)
      window.addEventListener('resize', handleResize)
      disposablesRef.current.push({
        dispose: () => window.removeEventListener('resize', handleResize)
      })

      // 保存定时器引用以便清理
      disposablesRef.current.push({
        dispose: () => clearTimeout(timer)
      })
    } catch (error) {
      console.error('设置编辑器监听器失败:', error)
    }
  }, [equalizeContentWidths, forceEditable, restoreCursorAfterChange, updateDiffCount])

  /** 处理编辑器挂载 */
  const handleEditorMount = useCallback((editor: MonacoDiffEditor, callbacks: {
    onOriginalChange?: (value: string) => void
    onModifiedChange?: (value: string) => void
  }) => {
    if (isUnmountingRef.current) return

    try {
      setEditorCallbacks(callbacks)
      diffEditorRef.current = editor
      setDiffCount(0)
      const originalEditor = editor.getOriginalEditor()
      const modifiedEditor = editor.getModifiedEditor()

      if (originalEditor && modifiedEditor) {
        originalEditor.updateOptions({
          readOnly: false,
          wordWrap: 'on',
          wrappingIndent: 'same',
        })
        modifiedEditor.updateOptions({
          readOnly: false,
          wordWrap: 'on',
          wrappingIndent: 'same',
        })
        setupEditorListeners(editor)
      }
    } catch (error) {
      console.error('编辑器挂载失败:', error)
    }
  }, [setEditorCallbacks, setupEditorListeners])

  /** 导航到下一个差异 */
  const navigateToNextDiff = useCallback(() => {
    const editor = diffEditorRef.current
    if (!editor || isUnmountingRef.current) return

    try {
      const modifiedEditor = editor.getModifiedEditor()
      const originalEditor = editor.getOriginalEditor()
      if (!modifiedEditor || !originalEditor) return

      const modifiedPosition = modifiedEditor.getPosition()
      const currentLine = modifiedPosition?.lineNumber || 1

      const lineChanges = editor.getLineChanges() as DiffLineChange[]
      if (!lineChanges || lineChanges.length === 0) return

      const nextDiff = lineChanges.find(change => change.modifiedStartLineNumber > currentLine)

      const targetDiff = nextDiff || lineChanges[0]
      modifiedEditor.setPosition({ lineNumber: targetDiff.modifiedStartLineNumber, column: 1 })
      modifiedEditor.revealLineInCenter(targetDiff.modifiedStartLineNumber)

      if (targetDiff.originalStartLineNumber) {
        originalEditor.setPosition({ lineNumber: targetDiff.originalStartLineNumber, column: 1 })
        originalEditor.revealLineInCenter(targetDiff.originalStartLineNumber)
      }
    } catch (error) {
      if (!isUnmountingRef.current) {
        console.error('导航到下一个差异失败:', error)
      }
    }
  }, [])

  /** 导航到上一个差异 */
  const navigateToPreviousDiff = useCallback(() => {
    const editor = diffEditorRef.current
    if (!editor || isUnmountingRef.current) return

    try {
      const modifiedEditor = editor.getModifiedEditor()
      const originalEditor = editor.getOriginalEditor()
      if (!modifiedEditor || !originalEditor) return

      const modifiedPosition = modifiedEditor.getPosition()
      const currentLine = modifiedPosition?.lineNumber || 1

      const lineChanges = editor.getLineChanges() as DiffLineChange[]
      if (!lineChanges || lineChanges.length === 0) return

      const previousDiffs = lineChanges.filter(change => change.modifiedStartLineNumber < currentLine)

      const targetDiff = previousDiffs.length > 0
        ? previousDiffs[previousDiffs.length - 1]
        : lineChanges[lineChanges.length - 1]

      modifiedEditor.setPosition({ lineNumber: targetDiff.modifiedStartLineNumber, column: 1 })
      modifiedEditor.revealLineInCenter(targetDiff.modifiedStartLineNumber)

      if (targetDiff.originalStartLineNumber) {
        originalEditor.setPosition({ lineNumber: targetDiff.originalStartLineNumber, column: 1 })
        originalEditor.revealLineInCenter(targetDiff.originalStartLineNumber)
      }
    } catch (error) {
      if (!isUnmountingRef.current) {
        console.error('导航到上一个差异失败:', error)
      }
    }
  }, [])

  /** 获取差异数量 */
  const getDiffCount = useCallback((): number => diffCount, [diffCount])

  /** 确保编辑器可编辑（当内容变化时调用） */
  const ensureEditable = useCallback(() => {
    const editor = diffEditorRef.current
    if (!editor || isUnmountingRef.current) return

    forceEditable(editor)

    // 只使用一个延迟定时器，而非原实现中的4个
    const timer = setTimeout(() => {
      if (!isUnmountingRef.current && diffEditorRef.current) {
        forceEditable(diffEditorRef.current)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [forceEditable])

  // 组件挂载时重置卸载标志，卸载时清理所有资源
  useEffect(() => {
    isUnmountingRef.current = false
    return () => {
      isUnmountingRef.current = true

      const disposables = [...disposablesRef.current]
      disposablesRef.current = []

      disposables.forEach(disposable => {
        try {
          if (disposable && typeof disposable.dispose === 'function') {
            disposable.dispose()
          }
        } catch { /* 忽略清理错误 */ }
      })

      diffEditorRef.current = null
    }
  }, [])

  return {
    diffEditorRef,
    handleEditorMount,
    navigateToNextDiff,
    navigateToPreviousDiff,
    getDiffCount,
    ensureEditable,
    setEditorCallbacks,
  }
}
