import { useState, useRef, useEffect, useCallback } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { diffLines, diffTrimmedLines } from 'diff'
import ToolLayout from '../components/ToolLayout'
import { useToast } from '../components/toastContext'
import { detectLanguageFromFileName, detectLanguageFromContent } from '../utils/languageDetection'
import { useFullscreen } from '../hooks/useFullscreen'
import { useDiffEditor } from '../hooks/useDiffEditor'
import { writeTextToClipboard } from '../utils/clipboard'
import { readExpiringStorage, writeExpiringStorage, TWO_DAYS_IN_MS } from '../utils/expiringStorage'
import type { MonacoDiffEditor } from '../types/monaco'
import './CodeDiff.css'
import '../styles/common.css'

const CODE_DIFF_DRAFT_KEY = 'dev-tools:code-diff:draft'

type CodeDiffDraft = {
  originalCode: string
  modifiedCode: string
  viewMode: 'split' | 'unified'
  language: string
  originalFileName: string
  modifiedFileName: string
  ignoreWhitespace: boolean
}

const DEFAULT_CODE_DIFF_DRAFT: CodeDiffDraft = {
  originalCode: '',
  modifiedCode: '',
  viewMode: 'split',
  language: 'plaintext',
  originalFileName: '',
  modifiedFileName: '',
  ignoreWhitespace: false,
}

const editorLoading = <div className="monaco-loading">编辑器加载中</div>

const CodeDiff = () => {
  const [initialDraft] = useState(() => (
    readExpiringStorage<CodeDiffDraft>(CODE_DIFF_DRAFT_KEY) ?? DEFAULT_CODE_DIFF_DRAFT
  ))
  const [originalCode, setOriginalCode] = useState(initialDraft.originalCode)
  const [modifiedCode, setModifiedCode] = useState(initialDraft.modifiedCode)
  const [editorContent, setEditorContent] = useState(() => ({
    originalCode: initialDraft.originalCode,
    modifiedCode: initialDraft.modifiedCode,
  }))
  const [viewMode, setViewMode] = useState<'split' | 'unified'>(initialDraft.viewMode)
  const [language, setLanguage] = useState<string>(initialDraft.language)
  const [originalFileName, setOriginalFileName] = useState(initialDraft.originalFileName)
  const [modifiedFileName, setModifiedFileName] = useState(initialDraft.modifiedFileName)
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(initialDraft.ignoreWhitespace)
  const diffPanelRef = useRef<HTMLDivElement>(null)

  // 使用自定义 Hook
  const [isFullscreen, toggleFullscreen] = useFullscreen(diffPanelRef)
  const {
    handleEditorMount,
    navigateToNextDiff,
    navigateToPreviousDiff,
    getDiffCount,
    ensureEditable,
    setEditorCallbacks,
  } = useDiffEditor()
  const { showToast } = useToast()

  useEffect(() => {
    writeExpiringStorage(
      CODE_DIFF_DRAFT_KEY,
      {
        originalCode,
        modifiedCode,
        viewMode,
        language,
        originalFileName,
        modifiedFileName,
        ignoreWhitespace,
      },
      TWO_DAYS_IN_MS
    )
  }, [
    originalCode,
    modifiedCode,
    viewMode,
    language,
    originalFileName,
    modifiedFileName,
    ignoreWhitespace,
  ])

  // 比较两个文件并输出差异到控制台
  const logDifferences = useCallback((original: string, modified: string) => {
    if (!original && !modified) return

    const originalLines = original.split(/\r\n|\r|\n/)
    const modifiedLines = modified.split(/\r\n|\r|\n/)
    const maxLines = Math.max(originalLines.length, modifiedLines.length)

    const differences: Array<{
      lineNumber: number
      original: string
      modified: string
      reason: string
    }> = []

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i] || ''
      const modLine = modifiedLines[i] || ''

      const comparableOrigLine = ignoreWhitespace ? origLine.trim() : origLine
      const comparableModLine = ignoreWhitespace ? modLine.trim() : modLine

      if (comparableOrigLine !== comparableModLine) {
        const origTrimmed = origLine.trim()
        const modTrimmed = modLine.trim()

        let reason = '内容不同'
        if (origTrimmed === modTrimmed) {
          reason = '空白字符差异'
        } else if (origLine.length !== modLine.length) {
          reason = `长度不同 (原始: ${origLine.length}, 修改: ${modLine.length})`
        }

        const origDisplay = origLine.replace(/\s/g, (match) => {
          if (match === ' ') return '·'
          if (match === '\t') return '→'
          if (match === '\r') return '\\r'
          return `[${match.charCodeAt(0)}]`
        })
        const modDisplay = modLine.replace(/\s/g, (match) => {
          if (match === ' ') return '·'
          if (match === '\t') return '→'
          if (match === '\r') return '\\r'
          return `[${match.charCodeAt(0)}]`
        })

        differences.push({
          lineNumber: i + 1,
          original: origDisplay,
          modified: modDisplay,
          reason
        })
      }
    }

    if (differences.length > 0) {
      console.group('🔍 代码差异分析')
      console.log(`总共发现 ${differences.length} 处差异`)
      console.table(differences)

      differences.forEach(diff => {
        console.group(`第 ${diff.lineNumber} 行 - ${diff.reason}`)
        console.log('原始:', JSON.stringify(diff.original))
        console.log('修改:', JSON.stringify(diff.modified))
        console.log('原始字符码:', diff.original.split('').map(c => c.charCodeAt(0)).join(', '))
        console.log('修改字符码:', diff.modified.split('').map(c => c.charCodeAt(0)).join(', '))
        console.groupEnd()
      })

      console.groupEnd()
    } else {
      console.log('✅ 两个文件内容完全一致')
    }
  }, [ignoreWhitespace])

  // 处理文件选择
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'original' | 'modified'
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    const fileName = file.name
    const detectedLangFromFile = detectLanguageFromFileName(fileName)

    try {
      const text = await file.text()

      // 如果从文件名检测不到，尝试从内容检测（传入当前 language 作为回退）
      const detectedLang = detectedLangFromFile === 'plaintext'
        ? detectLanguageFromContent(text, language)
        : detectedLangFromFile

      if (type === 'original') {
        setOriginalCode(text)
        setEditorContent(prev => ({ ...prev, originalCode: text }))
        setOriginalFileName(fileName)
        if (!language || language === 'plaintext') {
          setLanguage(detectedLang)
        }
      } else {
        setModifiedCode(text)
        setEditorContent(prev => ({ ...prev, modifiedCode: text }))
        setModifiedFileName(fileName)
        if (!language || language === 'plaintext') {
          setLanguage(detectedLang)
        }
      }

      showToast(`文件加载成功: ${fileName}`)
    } catch (error) {
      showToast(`读取文件失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      event.target.value = ''
    }
  }

  // 生成统一视图的差异显示
  const generateUnifiedDiff = (): string => {
    if (!originalCode && !modifiedCode) return ''

    const diff = ignoreWhitespace
      ? diffTrimmedLines(originalCode, modifiedCode)
      : diffLines(originalCode, modifiedCode)
    let result = ''

    diff.forEach((part) => {
      const lines = part.value.split('\n')
      lines.forEach((line, index) => {
        if (line === '' && index === lines.length - 1) return

        if (part.added) {
          result += `+ ${line}\n`
        } else if (part.removed) {
          result += `- ${line}\n`
        } else {
          result += `  ${line}\n`
        }
      })
    })

    return result
  }

  // 复制代码
  const copyCode = async (text: string, type: string) => {
    const success = await writeTextToClipboard(text)
    if (success) {
      showToast(`${type}代码已复制到剪贴板`)
    } else {
      showToast('复制失败', 'error')
    }
  }

  // 清空代码
  const clearCode = () => {
    setOriginalCode('')
    setModifiedCode('')
    setEditorContent({
      originalCode: '',
      modifiedCode: '',
    })
    setOriginalFileName('')
    setModifiedFileName('')
    setLanguage('plaintext')
  }

  // 交换代码
  const swapCode = () => {
    const tempCode = originalCode
    const tempFileName = originalFileName
    setOriginalCode(modifiedCode)
    setModifiedCode(tempCode)
    setEditorContent({
      originalCode: modifiedCode,
      modifiedCode: tempCode,
    })
    setOriginalFileName(modifiedFileName)
    setModifiedFileName(tempFileName)
  }

  // DiffEditor 的 original/modified prop 更新会改写 Monaco 模型。
  // 用户编辑时只同步业务状态，避免剪切/输入后由 prop 回写重置光标。
  const syncEditorContentFromState = useCallback(() => {
    setEditorContent({
      originalCode,
      modifiedCode,
    })
  }, [originalCode, modifiedCode])

  // 编辑器内容变化回调
  const handleOriginalChange = useCallback((value: string) => {
    setOriginalCode(value)
    // 如果语言是自动检测且代码不为空，尝试从内容检测语言
    if (language === 'plaintext' && value.trim()) {
      const detectedLang = detectLanguageFromContent(value, 'plaintext')
      if (detectedLang !== 'plaintext') {
        setLanguage(detectedLang)
      }
    }
  }, [language])

  const handleModifiedChange = useCallback((value: string) => {
    setModifiedCode(value)
    if (language === 'plaintext' && value.trim()) {
      const detectedLang = detectLanguageFromContent(value, 'plaintext')
      if (detectedLang !== 'plaintext') {
        setLanguage(detectedLang)
      }
    }
  }, [language])

  useEffect(() => {
    setEditorCallbacks({
      onOriginalChange: handleOriginalChange,
      onModifiedChange: handleModifiedChange,
    })
  }, [handleOriginalChange, handleModifiedChange, setEditorCallbacks])

  // 当两个文件都加载后，比较差异（修复：使用 useCallback 稳定引用，正确声明依赖）
  useEffect(() => {
    if (originalCode && modifiedCode) {
      logDifferences(originalCode, modifiedCode)
    }
  }, [originalCode, modifiedCode, logDifferences])

  // 确保编辑器可编辑（当内容变化时）
  useEffect(() => {
    const cleanup = ensureEditable()
    return () => cleanup?.()
  }, [originalCode, modifiedCode, ensureEditable])

  // 编辑器挂载回调工厂
  const createEditorMountHandler = useCallback(() => {
    return (editor: MonacoDiffEditor) => {
      handleEditorMount(editor, {
        onOriginalChange: handleOriginalChange,
        onModifiedChange: handleModifiedChange,
      })
    }
  }, [handleEditorMount, handleOriginalChange, handleModifiedChange])

  // 公共编辑器选项
  const commonEditorOptions = {
    minimap: { enabled: true } as const,
    fontSize: 14,
    wordWrap: 'on' as const,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    renderIndicators: true,
    ignoreTrimWhitespace: ignoreWhitespace,
    renderOverviewRuler: true,
    diffWordWrap: 'on' as const,
    wordWrapOverride1: 'on' as const,
    wordWrapOverride2: 'on' as const,
    originalEditable: true,
    formatOnPaste: false,
    formatOnType: false,
  }

  // 公共面板操作按钮
  const renderPanelActions = (isUnified: boolean) => (
    <>
      <label className="file-input-label">
        加载原始文件
        <input
          id="code-diff-original-file"
          name="codeDiffOriginalFile"
          type="file"
          onChange={(e) => handleFileSelect(e, 'original')}
          style={{ display: 'none' }}
        />
      </label>
      <label className="file-input-label">
        加载修改文件
        <input
          id="code-diff-modified-file"
          name="codeDiffModifiedFile"
          type="file"
          onChange={(e) => handleFileSelect(e, 'modified')}
          style={{ display: 'none' }}
        />
      </label>
      {(originalCode || modifiedCode) ? (
        <>
          <button onClick={navigateToPreviousDiff} className="btn-small btn-nav" title="上一个差异">↑ 上一个</button>
          <button onClick={navigateToNextDiff} className="btn-small btn-nav" title="下一个差异">↓ 下一个</button>
          <span className="diff-count">{getDiffCount()} 处差异</span>
          {isUnified ? (
            <button onClick={() => copyCode(generateUnifiedDiff(), '差异')} className="btn-small">复制差异</button>
          ) : (
            <>
              <button onClick={() => copyCode(originalCode, '原始')} className="btn-small" disabled={!originalCode}>复制原始</button>
              <button onClick={() => copyCode(modifiedCode, '修改后')} className="btn-small" disabled={!modifiedCode}>复制修改</button>
            </>
          )}
        </>
      ) : null}
      <button onClick={toggleFullscreen} className="btn-small btn-fullscreen" title={isFullscreen ? '退出全屏' : '全屏查看'}>
        {isFullscreen ? '⤓ 退出全屏' : '⛶ 全屏'}
      </button>
    </>
  )

  // 公共面板标题
  const renderPanelTitle = () => (
    <div className="panel-title">
      <span>{viewMode === 'split' ? '代码对比' : '差异对比'}</span>
      {(originalFileName || modifiedFileName) && (
        <span className="file-name">
          {originalFileName || '原始'} ↔ {modifiedFileName || '修改后'}
        </span>
      )}
    </div>
  )

  const toolbar = (
    <div className="diff-controls">
      <div className="view-mode-toggle">
        <button
          className={viewMode === 'split' ? 'btn-toggle active' : 'btn-toggle'}
          onClick={() => {
            syncEditorContentFromState()
            setViewMode('split')
          }}
        >
          分栏视图
        </button>
        <button
          className={viewMode === 'unified' ? 'btn-toggle active' : 'btn-toggle'}
          onClick={() => {
            syncEditorContentFromState()
            setViewMode('unified')
          }}
        >
          统一视图
        </button>
      </div>
      <div className="whitespace-toggle">
        <label className="toggle-switch">
          <input
            id="code-diff-ignore-whitespace"
            name="codeDiffIgnoreWhitespace"
            type="checkbox"
            checked={ignoreWhitespace}
            onChange={(e) => setIgnoreWhitespace(e.target.checked)}
          />
          <span className="toggle-slider"></span>
          <span className="toggle-label">忽略空格</span>
        </label>
      </div>
      <div className="language-select">
        <label htmlFor="code-diff-language">语言:</label>
        <select
          id="code-diff-language"
          name="codeDiffLanguage"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="plaintext">自动检测</option>
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
          <option value="c">C</option>
          <option value="csharp">C#</option>
          <option value="php">PHP</option>
          <option value="go">Go</option>
          <option value="rust">Rust</option>
          <option value="ruby">Ruby</option>
          <option value="swift">Swift</option>
          <option value="kotlin">Kotlin</option>
          <option value="scala">Scala</option>
          <option value="shell">Shell</option>
          <option value="sql">SQL</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="scss">SCSS</option>
          <option value="json">JSON</option>
          <option value="xml">XML</option>
          <option value="yaml">YAML</option>
          <option value="markdown">Markdown</option>
          <option value="dockerfile">Dockerfile</option>
          <option value="r">R</option>
          <option value="lua">Lua</option>
          <option value="perl">Perl</option>
          <option value="dart">Dart</option>
          <option value="clojure">Clojure</option>
          <option value="haskell">Haskell</option>
          <option value="ocaml">OCaml</option>
          <option value="fsharp">F#</option>
          <option value="vb">Visual Basic</option>
          <option value="powershell">PowerShell</option>
          <option value="bat">Batch</option>
          <option value="ini">INI</option>
          <option value="toml">TOML</option>
          <option value="properties">Properties</option>
        </select>
      </div>
      <button onClick={swapCode} className="btn btn-secondary" disabled={!originalCode || !modifiedCode}>
        交换
      </button>
      <button onClick={clearCode} className="btn btn-danger">
        清空
      </button>
    </div>
  )

  return (
    <ToolLayout
      className={`code-diff ${isFullscreen ? 'fullscreen-mode' : ''}`}
      title="代码对比"
      description="对比两段代码或文件内容，支持分栏和统一视图"
      actions={toolbar}
      hideHeader={isFullscreen}
    >

      {viewMode === 'split' ? (
        <div className="split-view">
          <div
            ref={diffPanelRef}
            className={`editor-panel diff-panel ${isFullscreen ? 'fullscreen-panel' : ''}`}
          >
            <div className="panel-header">
              {renderPanelTitle()}
              <div className="panel-actions">
                {renderPanelActions(false)}
              </div>
            </div>
            <DiffEditor
              height={isFullscreen ? 'calc(100vh - 60px)' : '100%'}
              language={language}
              original={editorContent.originalCode}
              modified={editorContent.modifiedCode}
              loading={editorLoading}
              originalModelPath="inmemory://model/code-diff/original"
              modifiedModelPath="inmemory://model/code-diff/modified"
              keepCurrentOriginalModel
              keepCurrentModifiedModel
              theme="vs-dark"
              options={{
                ...commonEditorOptions,
                renderSideBySide: true,
                enableSplitViewResizing: true,
                splitViewDefaultRatio: 0.5,
              }}
              onMount={createEditorMountHandler()}
            />
          </div>
        </div>
      ) : (
        <div className="unified-view">
          <div
            ref={diffPanelRef}
            className={`editor-panel diff-panel ${isFullscreen ? 'fullscreen-panel' : ''}`}
          >
            <div className="panel-header">
              {renderPanelTitle()}
              <div className="panel-actions">
                {renderPanelActions(true)}
              </div>
            </div>
            {originalCode || modifiedCode ? (
              <DiffEditor
                height={isFullscreen ? 'calc(100vh - 60px)' : '100%'}
                language={language}
                original={editorContent.originalCode}
                modified={editorContent.modifiedCode}
                loading={editorLoading}
                originalModelPath="inmemory://model/code-diff/original"
                modifiedModelPath="inmemory://model/code-diff/modified"
                keepCurrentOriginalModel
                keepCurrentModifiedModel
                theme="vs-dark"
                options={{
                  ...commonEditorOptions,
                  renderSideBySide: false,
                  enableSplitViewResizing: false,
                }}
                onMount={createEditorMountHandler()}
              />
            ) : (
              <div className="empty-state">
                <p>请在分栏视图中输入代码，或加载文件进行对比</p>
                <p className="hint">切换到"分栏视图"可以分别编辑原始代码和修改后的代码</p>
              </div>
            )}
          </div>
        </div>
      )}
    </ToolLayout>
  )
}

export default CodeDiff
