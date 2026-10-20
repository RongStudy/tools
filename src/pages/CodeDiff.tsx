import EditorLanguageTools, { type EditorLanguageBinding } from '../components/EditorLanguageTools'
import { languageEditorOptions } from '../monaco/languageCapabilities'
import { useDraftPersistence } from '../hooks/useDraftPersistence'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { diffLines, diffTrimmedLines } from 'diff'
import ToolLayout from '../components/ToolLayout'
import { useToast } from '../components/toastContext'
import { useAppTheme } from '../themeContext'
import { useDetectedLanguages } from '../hooks/useDetectedLanguages'
import { useDiffEditor } from '../hooks/useDiffEditor'
import { modelPath, useMonacoModels } from '../hooks/useMonacoModels'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { writeTextToClipboard } from '../utils/clipboard'
import { readExpiringStorage } from '../utils/expiringStorage'
import type { MonacoDiffEditor } from '../types/monaco'
import './CodeDiff.css'
import '../styles/common.css'

const CODE_DIFF_DRAFT_KEY = 'dev-tools:code-diff:draft'

type CodeDiffDraft = {
  activeDocumentId: string
  documents: CodeDiffDocument[]
  languageDetectionVersion?: number
}

type CodeDiffDocument = {
  id: string
  name: string
  originalCode: string
  modifiedCode: string
  viewMode: 'split' | 'unified'
  language: string
  originalFileName: string
  modifiedFileName: string
  ignoreWhitespace: boolean
  hideUnchanged: boolean
  showMoves: boolean
}

type LegacyCodeDiffDraft = Omit<CodeDiffDocument, 'id' | 'name'>

const DEFAULT_CODE_DIFF_DOCUMENT: CodeDiffDocument = {
  id: 'diff-1',
  name: '对比 1',
  originalCode: '',
  modifiedCode: '',
  viewMode: 'split',
  language: 'auto',
  originalFileName: '',
  modifiedFileName: '',
  ignoreWhitespace: false,
  hideUnchanged: false,
  showMoves: false,
}

const DEFAULT_CODE_DIFF_DRAFT: CodeDiffDraft = {
  activeDocumentId: DEFAULT_CODE_DIFF_DOCUMENT.id,
  documents: [DEFAULT_CODE_DIFF_DOCUMENT],
}

const createCodeDiffDocument = (documents: CodeDiffDocument[]): CodeDiffDocument => {
  const highestDocumentNumber = documents.reduce((highest, document) => {
    const match = /^对比 (\d+)$/.exec(document.name)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)

  return {
    ...DEFAULT_CODE_DIFF_DOCUMENT,
    id: `diff-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: `对比 ${highestDocumentNumber + 1}`,
  }
}

const isCodeDiffDocument = (value: unknown): value is CodeDiffDocument => {
  if (!value || typeof value !== 'object') return false

  const document = value as Partial<CodeDiffDocument>
  return typeof document.id === 'string'
    && typeof document.name === 'string'
    && typeof document.originalCode === 'string'
    && typeof document.modifiedCode === 'string'
    && (document.viewMode === 'split' || document.viewMode === 'unified')
    && typeof document.language === 'string'
    && typeof document.originalFileName === 'string'
    && typeof document.modifiedFileName === 'string'
    && typeof document.ignoreWhitespace === 'boolean'
}

const readCodeDiffDraft = (): CodeDiffDraft => {
  const savedDraft = readExpiringStorage<unknown>(CODE_DIFF_DRAFT_KEY)
  if (!savedDraft || typeof savedDraft !== 'object') return DEFAULT_CODE_DIFF_DRAFT

  const draft = savedDraft as Partial<CodeDiffDraft & LegacyCodeDiffDraft>
  if (Array.isArray(draft.documents)) {
    const documents = draft.documents.filter(isCodeDiffDocument).map((document) => ({
      ...document,
      language: draft.languageDetectionVersion !== 1 && document.language === 'plaintext' ? 'auto' : document.language,
      hideUnchanged: document.hideUnchanged === true,
      showMoves: document.showMoves === true,
    }))
    const activeDocumentId = documents.some((document) => document.id === draft.activeDocumentId)
      ? draft.activeDocumentId as string
      : documents[0]?.id
    if (documents.length && activeDocumentId) return { activeDocumentId, documents }
  }

  if (typeof draft.originalCode === 'string'
    && typeof draft.modifiedCode === 'string'
    && (draft.viewMode === 'split' || draft.viewMode === 'unified')
    && typeof draft.language === 'string'
    && typeof draft.originalFileName === 'string'
    && typeof draft.modifiedFileName === 'string'
    && typeof draft.ignoreWhitespace === 'boolean') {
    return {
      activeDocumentId: DEFAULT_CODE_DIFF_DOCUMENT.id,
      documents: [{
        ...DEFAULT_CODE_DIFF_DOCUMENT,
        originalCode: draft.originalCode,
        modifiedCode: draft.modifiedCode,
        viewMode: draft.viewMode,
        language: draft.language === 'plaintext' ? 'auto' : draft.language,
        originalFileName: draft.originalFileName,
        modifiedFileName: draft.modifiedFileName,
        ignoreWhitespace: draft.ignoreWhitespace,
      }],
    }
  }

  return DEFAULT_CODE_DIFF_DRAFT
}

const editorLoading = <div className="monaco-loading">编辑器加载中</div>

const CodeDiff = () => {
  const { monacoTheme } = useAppTheme()
  const [initialDraft] = useState(readCodeDiffDraft)
  const [documents, setDocuments] = useState(initialDraft.documents)
  const [activeDocumentId, setActiveDocumentId] = useState(initialDraft.activeDocumentId)
  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0]
  const {
    originalCode,
    modifiedCode,
    viewMode,
    language,
    originalFileName,
    modifiedFileName,
    ignoreWhitespace,
    hideUnchanged,
    showMoves,
  } = activeDocument
  const languageInputs = useMemo(() => [
    { id: `${activeDocument.id}/original`, language, content: originalCode, filename: originalFileName },
    { id: `${activeDocument.id}/modified`, language, content: modifiedCode, filename: modifiedFileName },
  ], [activeDocument.id, language, originalCode, modifiedCode, originalFileName, modifiedFileName])
  const detectedLanguages = useDetectedLanguages(languageInputs)
  const originalLanguage = detectedLanguages[`${activeDocument.id}/original`]
  const modifiedLanguage = detectedLanguages[`${activeDocument.id}/modified`]
  const registerMonaco = useMonacoModels(documents.flatMap(({ id }) => [modelPath('diff', id, 'original'), modelPath('diff', id, 'modified')]))
  const [editorContent, setEditorContent] = useState(() => ({
    originalCode: activeDocument.originalCode,
    modifiedCode: activeDocument.modifiedCode,
  }))
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [languageBindings, setLanguageBindings] = useState<{ original: EditorLanguageBinding; modified: EditorLanguageBinding }>()
  const {
    handleEditorMount,
    navigateToNextDiff,
    navigateToPreviousDiff,
    getDiffCount,
    ensureEditable,
    setEditorCallbacks,
  } = useDiffEditor(activeDocument.id)
  const { showToast } = useToast()

  useEscapeToClose(isFullscreen, () => setIsFullscreen(false))

  const draft = useMemo(() => ({ activeDocumentId, documents, languageDetectionVersion: 1 }), [activeDocumentId, documents])
  useDraftPersistence(CODE_DIFF_DRAFT_KEY, draft)

  const updateActiveDocument = useCallback((updates: Partial<Omit<CodeDiffDocument, 'id' | 'name'>>) => {
    setDocuments((currentDocuments) => currentDocuments.map((document) => (
      document.id === activeDocumentId ? { ...document, ...updates } : document
    )))
  }, [activeDocumentId])

  // 处理文件选择
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'original' | 'modified'
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    const fileName = file.name

    try {
      const text = await file.text()

      if (type === 'original') {
        updateActiveDocument({ originalCode: text, originalFileName: fileName })
        setEditorContent((currentContent) => ({ ...currentContent, originalCode: text }))
      } else {
        updateActiveDocument({ modifiedCode: text, modifiedFileName: fileName })
        setEditorContent((currentContent) => ({ ...currentContent, modifiedCode: text }))
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
    updateActiveDocument({
      originalCode: '',
      modifiedCode: '',
      originalFileName: '',
      modifiedFileName: '',
      language: 'auto',
    })
    setEditorContent({
      originalCode: '',
      modifiedCode: '',
    })
  }

  // 交换代码
  const swapCode = () => {
    const tempCode = originalCode
    const tempFileName = originalFileName
    updateActiveDocument({
      originalCode: modifiedCode,
      modifiedCode: tempCode,
      originalFileName: modifiedFileName,
      modifiedFileName: tempFileName,
    })
    setEditorContent({
      originalCode: modifiedCode,
      modifiedCode: tempCode,
    })
  }

  // DiffEditor 的 original/modified prop 更新会改写 Monaco 模型。
  // 用户编辑时只同步业务状态，避免剪切/输入后由 prop 回写重置光标。
  const syncEditorContentFromState = useCallback(() => {
    setEditorContent({
      originalCode,
      modifiedCode,
    })
  }, [originalCode, modifiedCode])

  const selectDocument = (document: CodeDiffDocument) => {
    setEditorContent({
      originalCode: document.originalCode,
      modifiedCode: document.modifiedCode,
    })
    setActiveDocumentId(document.id)
  }

  const addDocument = () => {
    const document = createCodeDiffDocument(documents)
    setDocuments((currentDocuments) => [...currentDocuments, document])
    selectDocument(document)
  }

  const closeDocument = (documentId: string) => {
    const currentIndex = documents.findIndex((document) => document.id === documentId)
    const nextDocument = documents[currentIndex + 1] ?? documents[currentIndex - 1]
    setDocuments((currentDocuments) => currentDocuments.filter((document) => document.id !== documentId))
    if (documentId === activeDocumentId) selectDocument(nextDocument)
  }

  // 编辑器内容变化回调
  const handleOriginalChange = useCallback((value: string) => {
    updateActiveDocument({ originalCode: value })
  }, [updateActiveDocument])

  const handleModifiedChange = useCallback((value: string) => {
    updateActiveDocument({ modifiedCode: value })
  }, [updateActiveDocument])

  useEffect(() => {
    setEditorCallbacks({
      onOriginalChange: handleOriginalChange,
      onModifiedChange: handleModifiedChange,
    })
  }, [handleOriginalChange, handleModifiedChange, setEditorCallbacks])

  // 确保编辑器可编辑（当内容变化时）
  useEffect(() => {
    const cleanup = ensureEditable()
    return () => cleanup?.()
  }, [activeDocumentId, originalCode, modifiedCode, ensureEditable])

  // 编辑器挂载回调工厂
  const createEditorMountHandler = useCallback(() => {
    return (editor: MonacoDiffEditor, monaco: Parameters<typeof registerMonaco>[0]) => {
      registerMonaco(monaco)
      setLanguageBindings({ original: { editor: editor.getOriginalEditor(), monaco }, modified: { editor: editor.getModifiedEditor(), monaco } })
      handleEditorMount(editor, {
        onOriginalChange: handleOriginalChange,
        onModifiedChange: handleModifiedChange,
      })
    }
  }, [handleEditorMount, handleOriginalChange, handleModifiedChange, registerMonaco])

  // 公共编辑器选项
  const commonEditorOptions = {
    ...languageEditorOptions,
    originalAriaLabel: '原始代码',
    modifiedAriaLabel: '修改代码',
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
    hideUnchangedRegions: { enabled: hideUnchanged },
    experimental: { showMoves },
  }

  const renderLanguageTools = () => (
    <>
      {language === 'auto' && <span className="editor-language-label" role="status" aria-label="自动检测结果">原始：{originalLanguage} · 修改：{modifiedLanguage}</span>}
      <EditorLanguageTools binding={languageBindings?.original} language={originalLanguage} path={modelPath('diff', activeDocument.id, 'original')} label="原始代码" caption="原始" />
      <EditorLanguageTools binding={languageBindings?.modified} language={modifiedLanguage} path={modelPath('diff', activeDocument.id, 'modified')} label="修改代码" caption="修改" />
    </>
  )

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
      <button onClick={() => setIsFullscreen((value) => !value)} className="btn-small btn-fullscreen" title={isFullscreen ? '退出全屏' : '全屏查看'}>
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
            updateActiveDocument({ viewMode: 'split' })
          }}
        >
          分栏视图
        </button>
        <button
          className={viewMode === 'unified' ? 'btn-toggle active' : 'btn-toggle'}
          onClick={() => {
            syncEditorContentFromState()
            updateActiveDocument({ viewMode: 'unified' })
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
            onChange={(e) => updateActiveDocument({ ignoreWhitespace: e.target.checked })}
          />
          <span className="toggle-slider"></span>
          <span className="toggle-label">忽略空格</span>
        </label>
      </div>
      <div className="language-select">
        <label className="toggle-switch">
          <input type="checkbox" checked={hideUnchanged} onChange={(e) => updateActiveDocument({ hideUnchanged: e.target.checked })} />
          <span className="toggle-slider"></span>
          <span className="toggle-label">仅看差异</span>
        </label>
        <label className="toggle-switch">
          <input type="checkbox" checked={showMoves} onChange={(e) => updateActiveDocument({ showMoves: e.target.checked })} />
          <span className="toggle-slider"></span>
          <span className="toggle-label">识别移动</span>
        </label>
      </div>
      <div className="language-select">
        <label htmlFor="code-diff-language">语言:</label>
        <select
          id="code-diff-language"
          name="codeDiffLanguage"
          value={language}
          onChange={(e) => updateActiveDocument({ language: e.target.value })}
        >
          <option value="auto">自动检测</option>
          <option value="plaintext">纯文本</option>
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
      {!isFullscreen && (
        <div className="code-diff-tabs" role="tablist" aria-label="代码对比文档">
          <div className="code-diff-tab-list">
            {documents.map((document) => (
              <div className="code-diff-tab" key={document.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={document.id === activeDocumentId}
                  className={`code-diff-tab-button ${document.id === activeDocumentId ? 'is-active' : ''}`}
                  onClick={() => selectDocument(document)}
                >
                  {document.name}
                </button>
                {documents.length > 1 && (
                  <button
                    type="button"
                    className="code-diff-tab-close"
                    aria-label={`关闭 ${document.name}`}
                    title={`关闭 ${document.name}`}
                    onClick={() => closeDocument(document.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-small code-diff-tab-add"
            onClick={addDocument}
          >
            新建对比
          </button>
        </div>
      )}
      {viewMode === 'split' ? (
        <div className="split-view">
          <div
            className={`editor-panel diff-panel ${isFullscreen ? 'fullscreen-panel' : ''}`}
          >
            <div className="panel-header">
              {renderPanelTitle()}
              <div className="panel-actions">
                {renderLanguageTools()}
                {renderPanelActions(false)}
              </div>
            </div>
            <DiffEditor
              key={`${activeDocument.id}-split`}
              height={isFullscreen ? 'calc(100vh - 60px)' : '100%'}
              originalLanguage={originalLanguage}
              modifiedLanguage={modifiedLanguage}
              original={editorContent.originalCode}
              modified={editorContent.modifiedCode}
              loading={editorLoading}
              originalModelPath={modelPath('diff', activeDocument.id, 'original')}
              modifiedModelPath={modelPath('diff', activeDocument.id, 'modified')}
              keepCurrentOriginalModel
              keepCurrentModifiedModel
              theme={monacoTheme}
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
            className={`editor-panel diff-panel ${isFullscreen ? 'fullscreen-panel' : ''}`}
          >
            <div className="panel-header">
              {renderPanelTitle()}
              <div className="panel-actions">
                {renderLanguageTools()}
                {renderPanelActions(true)}
              </div>
            </div>
            {originalCode || modifiedCode ? (
              <DiffEditor
                key={`${activeDocument.id}-unified`}
                height={isFullscreen ? 'calc(100vh - 60px)' : '100%'}
                originalLanguage={originalLanguage}
                modifiedLanguage={modifiedLanguage}
                original={editorContent.originalCode}
                modified={editorContent.modifiedCode}
                loading={editorLoading}
                originalModelPath={modelPath('diff', activeDocument.id, 'original')}
                modifiedModelPath={modelPath('diff', activeDocument.id, 'modified')}
                keepCurrentOriginalModel
                keepCurrentModifiedModel
                theme={monacoTheme}
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
