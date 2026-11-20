import { t, useLocale } from '../i18n'
import EditorStatusBar from '../components/EditorStatusBar'
import DocumentTab from '../components/DocumentTab'
import EditorLanguageTools, { type EditorLanguageBinding } from '../components/EditorLanguageTools'
import { languageEditorOptions } from '../monaco/languageCapabilities'
import { useDraftPersistence } from '../hooks/useDraftPersistence'
import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { diffLines, diffTrimmedLines } from 'diff'
import ToolLayout from '../components/ToolLayout'
import ToolOptions from '../components/ToolOptions'
import { useToast } from '../components/toastContext'
import { useAppTheme } from '../themeContext'
import { useDetectedLanguages } from '../hooks/useDetectedLanguages'
import { useDiffEditor } from '../hooks/useDiffEditor'
import { modelPath, useMonacoModels } from '../hooks/useMonacoModels'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { writeTextToClipboard } from '../utils/clipboard'
import { readExpiringStorage } from '../utils/expiringStorage'
import { openLocalFile, supportsFileWriteback, type OpenLocalFile } from '../utils/localFile'
import { useLocalFiles } from '../hooks/useLocalFiles'
import LocalFileSave from '../components/LocalFileSave'
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
    const match = /^(?:对比|Diff) (\d+)$/.exec(document.name)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)

  return {
    ...DEFAULT_CODE_DIFF_DOCUMENT,
    id: `diff-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: t("对比 {value0}", { value0: highestDocumentNumber + 1 }),
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
  const defaultDraft = { ...DEFAULT_CODE_DIFF_DRAFT, documents: DEFAULT_CODE_DIFF_DRAFT.documents.map((document) => ({ ...document, name: t("对比 {value0}", { value0: 1 }) })) }
  const savedDraft = readExpiringStorage<unknown>(CODE_DIFF_DRAFT_KEY)
  if (!savedDraft || typeof savedDraft !== 'object') return defaultDraft

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

  return defaultDraft
}

const CodeDiff = () => {
  useLocale()
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
  const localFiles = useLocalFiles()
  const selectedDocumentRef = useRef(activeDocumentId)
  const pendingLoads = useRef(new Map<string, symbol>())
  useEffect(() => {
    const requests = pendingLoads.current
    return () => requests.clear()
  }, [])
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
  const clearSavedDraft = useDraftPersistence(CODE_DIFF_DRAFT_KEY, draft)

  const updateActiveDocument = useCallback((updates: Partial<Omit<CodeDiffDocument, 'id' | 'name'>>) => {
    setDocuments((currentDocuments) => currentDocuments.map((document) => (
      document.id === activeDocumentId ? { ...document, ...updates } : document
    )))
  }, [activeDocumentId])

  const applyLoadedFile = (documentId: string, type: 'original' | 'modified', request: symbol, name: string, content: string, opened?: OpenLocalFile) => {
    const key = `${documentId}/${type}`
    if (pendingLoads.current.get(key) !== request) return
    pendingLoads.current.delete(key)
    if (opened) localFiles.bind(key, opened)
    else localFiles.remove(key)
    const updates = type === 'original'
      ? { originalCode: content, originalFileName: name }
      : { modifiedCode: content, modifiedFileName: name }
    setDocuments((current) => current.map((document) => document.id === documentId ? { ...document, ...updates } : document))
    if (selectedDocumentRef.current === documentId) {
      setEditorContent((current) => type === 'original' ? { ...current, originalCode: content } : { ...current, modifiedCode: content })
    }
    showToast(t("文件加载成功: {value0}", { value0: name }))
  }

  // 每侧只接受最近一次读取；切换标签时仅更新发起读取的文档。
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'original' | 'modified'
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const documentId = activeDocumentId
    const key = `${documentId}/${type}`
    const request = Symbol()
    pendingLoads.current.set(key, request)
    try {
      const text = await file.text()
      applyLoadedFile(documentId, type, request, file.name, text)
    } catch (error) {
      if (pendingLoads.current.get(key) === request) localFiles.reportLoadError(error)
    } finally {
      if (pendingLoads.current.get(key) === request) pendingLoads.current.delete(key)
    }
  }

  const chooseFile = async (type: 'original' | 'modified') => {
    if (!supportsFileWriteback()) {
      document.getElementById('code-diff-' + type + '-file')?.click()
      return
    }
    const documentId = activeDocumentId
    const key = `${documentId}/${type}`
    const request = Symbol()
    pendingLoads.current.set(key, request)
    try {
      const opened = await openLocalFile()
      applyLoadedFile(documentId, type, request, opened.name, opened.content, 'handle' in opened ? opened : undefined)
    } catch (error) {
      if (pendingLoads.current.get(key) === request) localFiles.reportLoadError(error)
    } finally {
      if (pendingLoads.current.get(key) === request) pendingLoads.current.delete(key)
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
      showToast(t("{value0}代码已复制到剪贴板", { value0: type }))
    } else {
      showToast(t("复制失败"), 'error')
    }
  }

  // 清空代码
  const clearCode = () => {
    pendingLoads.current.delete(`${activeDocumentId}/original`)
    pendingLoads.current.delete(`${activeDocumentId}/modified`)
    localFiles.remove(`${activeDocumentId}/original`, `${activeDocumentId}/modified`)
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
    pendingLoads.current.delete(`${activeDocumentId}/original`)
    pendingLoads.current.delete(`${activeDocumentId}/modified`)
    localFiles.swap(`${activeDocumentId}/original`, `${activeDocumentId}/modified`)
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
    selectedDocumentRef.current = document.id
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
    pendingLoads.current.delete(`${documentId}/original`)
    pendingLoads.current.delete(`${documentId}/modified`)
    localFiles.remove(`${documentId}/original`, `${documentId}/modified`)
    const currentIndex = documents.findIndex((document) => document.id === documentId)
    const nextDocument = documents[currentIndex + 1] ?? documents[currentIndex - 1]
    setDocuments((currentDocuments) => currentDocuments.filter((document) => document.id !== documentId))
    if (documentId === activeDocumentId) selectDocument(nextDocument)
  }

  // 编辑器内容变化回调
  const handleOriginalChange = useCallback((value: string) => {
    pendingLoads.current.delete(`${activeDocumentId}/original`)
    updateActiveDocument({ originalCode: value })
  }, [activeDocumentId, updateActiveDocument])

  const handleModifiedChange = useCallback((value: string) => {
    pendingLoads.current.delete(`${activeDocumentId}/modified`)
    updateActiveDocument({ modifiedCode: value })
  }, [activeDocumentId, updateActiveDocument])

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
    originalAriaLabel: t("原始代码"),
    modifiedAriaLabel: t("修改代码"),
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
    <div className="diff-language-toolbar">
      {(['original', 'modified'] as const).map((side) => {
        const isOriginal = side === 'original'
        const detected = isOriginal ? originalLanguage : modifiedLanguage
        const content = isOriginal ? originalCode : modifiedCode
        const filename = isOriginal ? originalFileName : modifiedFileName
        const label = isOriginal ? t('原始代码') : t('修改代码')
        const loadLabel = isOriginal ? t('加载原始文件') : t('加载修改文件')
        const key = activeDocumentId + '/' + side
        const file = localFiles.files[key]
        return <div className="diff-side-tools" key={side}>
          <span className="diff-side-identity" role="status" aria-label={label}>
            <strong>{isOriginal ? t('原始') : t('修改')}</strong>
            <span className="diff-side-language">{detected}</span>
            {filename && <span className="diff-side-filename" title={filename}>{filename}</span>}
          </span>
          <div className="diff-side-actions">
            <input id={'code-diff-' + side + '-file'} type="file" hidden aria-label={loadLabel} onChange={(event) => handleFileSelect(event, side)} />
            <button type="button" className="btn-small" aria-label={loadLabel} onClick={() => void chooseFile(side)}>{t('加载文件')}</button>
            <button type="button" className="btn-small" aria-label={isOriginal ? t('复制原始') : t('复制修改')} onClick={() => copyCode(content, isOriginal ? t('原始') : t('修改后'))} disabled={!content}>{t('复制')}</button>
            <LocalFileSave file={file} content={content}
              label={isOriginal ? t('保存原始文件') : t('保存修改文件')} disabled={localFiles.savingFile !== null}
              saving={localFiles.savingFile === file}
              onSave={() => localFiles.save(key, content)} />
            <EditorLanguageTools binding={languageBindings?.[side]} language={detected} path={modelPath('diff', activeDocument.id, side)} label={label} />
          </div>
        </div>
      })}
    </div>
  )

  const renderWorkspaceActions = () => <div className="diff-workspace-actions">
    {(originalCode || modifiedCode) && <div className="diff-navigation">
      <button onClick={navigateToPreviousDiff} className="btn-small" aria-label={t('上一个差异')} title={t('上一个差异')}>↑</button>
      <span className="diff-count">{getDiffCount()} {t('处差异')}</span>
      <button onClick={navigateToNextDiff} className="btn-small" aria-label={t('下一个差异')} title={t('下一个差异')}>↓</button>
    </div>}
    {viewMode === 'unified' && <button onClick={() => copyCode(generateUnifiedDiff(), t('差异'))} className="btn-small" disabled={!originalCode && !modifiedCode}>{t('复制差异')}</button>}
    <button onClick={() => setIsFullscreen((value) => !value)} className="btn-small btn-fullscreen" title={isFullscreen ? t('退出全屏') : t('全屏查看')}>
      {isFullscreen ? t('⤓ 退出全屏') : t('⛶ 全屏')}
    </button>
  </div>

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
          {t("分栏视图")}</button>
        <button
          className={viewMode === 'unified' ? 'btn-toggle active' : 'btn-toggle'}
          onClick={() => {
            syncEditorContentFromState()
            updateActiveDocument({ viewMode: 'unified' })
          }}
        >
          {t("统一视图")}</button>
      </div>
      <button onClick={swapCode} className="btn btn-secondary" disabled={!originalCode || !modifiedCode}>
        {t("交换")}</button>
      <ToolOptions count={Number(ignoreWhitespace) + Number(hideUnchanged) + Number(showMoves) + Number(language !== 'auto')}>
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
          <span className="toggle-label">{t("忽略空格")}</span>
        </label>
      </div>
      <div className="language-select">
        <label className="toggle-switch">
          <input type="checkbox" checked={hideUnchanged} onChange={(e) => updateActiveDocument({ hideUnchanged: e.target.checked })} />
          <span className="toggle-slider"></span>
          <span className="toggle-label">{t("仅看差异")}</span>
        </label>
        <label className="toggle-switch">
          <input type="checkbox" checked={showMoves} onChange={(e) => updateActiveDocument({ showMoves: e.target.checked })} />
          <span className="toggle-slider"></span>
          <span className="toggle-label">{t("识别移动")}</span>
        </label>
      </div>
      <div className="language-select">
        <label htmlFor="code-diff-language">{t("语言:")}</label>
        <select
          id="code-diff-language"
          name="codeDiffLanguage"
          value={language}
          onChange={(e) => updateActiveDocument({ language: e.target.value })}
        >
          <option value="auto">{t("自动检测")}</option>
          <option value="plaintext">{t("纯文本")}</option>
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
      <hr className="tool-options-divider" />
      <button type="button" className="btn btn-secondary" onClick={clearSavedDraft}>{t("清除已保存草稿")}</button>
      </ToolOptions>
      <button onClick={clearCode} className="btn btn-danger">
        {t("清空")}</button>
    </div>
  )

  return (
    <ToolLayout
      className={`code-diff ${isFullscreen ? 'fullscreen-mode' : ''}`}
      title={t("代码对比")}
      actions={toolbar}
      hideHeader={isFullscreen}
    >
      <div className={isFullscreen ? 'diff-document-bar' : 'code-diff-tabs document-tabs diff-document-bar'}>
        {!isFullscreen && <>
          <div className="code-diff-tab-list document-tab-list" role="tablist" aria-label={t('代码对比文档')}>
            {documents.map((document) => (
              <DocumentTab
                key={document.id}
                prefix="code-diff"
                name={document.name}
                selected={document.id === activeDocumentId}
                onSelect={() => selectDocument(document)}
                onRename={(name) => setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, name } : item))}
                onClose={documents.length > 1 ? () => closeDocument(document.id) : undefined}
              />
            ))}
          </div>
          <button
            type="button"
            className="btn-small code-diff-tab-add document-tab-add"
            onClick={addDocument}
          >
            {t("新建对比")}</button>
        </>}
        {renderWorkspaceActions()}
      </div>
      {viewMode === 'split' ? (
        <div className="split-view">
          <div
            className={`editor-panel diff-panel ${isFullscreen ? 'fullscreen-panel' : ''}`}
          >
            {renderLanguageTools()}
            <div className="diff-editor-body">
              <DiffEditor
                key={`${activeDocument.id}-split`}
                height="100%"
                originalLanguage={originalLanguage}
                modifiedLanguage={modifiedLanguage}
                original={editorContent.originalCode}
                modified={editorContent.modifiedCode}
                loading={<div className="monaco-loading">{t("编辑器加载中")}</div>}
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
            <div className="diff-status-bars">
              <EditorStatusBar text={originalCode} label={t("原始代码")}>{t("原始")}</EditorStatusBar>
              <EditorStatusBar text={modifiedCode} label={t("修改代码")}>{t("修改")}</EditorStatusBar>
            </div>
          </div>
        </div>
      ) : (
        <div className="unified-view">
          <div
            className={`editor-panel diff-panel ${isFullscreen ? 'fullscreen-panel' : ''}`}
          >
            {renderLanguageTools()}
            <div className="diff-editor-body">
              {originalCode || modifiedCode ? (
                <DiffEditor
                  key={`${activeDocument.id}-unified`}
                  height="100%"
                  originalLanguage={originalLanguage}
                  modifiedLanguage={modifiedLanguage}
                  original={editorContent.originalCode}
                  modified={editorContent.modifiedCode}
                  loading={<div className="monaco-loading">{t("编辑器加载中")}</div>}
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
                  <p>{t("请在分栏视图中输入代码，或加载文件进行对比")}</p>
                  <p className="hint">{t("切换到\"分栏视图\"可以分别编辑原始代码和修改后的代码")}</p>
                </div>
              )}
            </div>
            <div className="diff-status-bars">
              <EditorStatusBar text={originalCode} label={t("原始代码")}>{t("原始")}</EditorStatusBar>
              <EditorStatusBar text={modifiedCode} label={t("修改代码")}>{t("修改")}</EditorStatusBar>
            </div>
          </div>
        </div>
      )}
    </ToolLayout>
  )
}

export default CodeDiff
