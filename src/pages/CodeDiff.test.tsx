import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CodeDiff from './CodeDiff'
import { ToastProvider } from '../components/Toast'

vi.mock('@monaco-editor/react', () => ({
  DiffEditor: ({
    original,
    modified,
    originalModelPath,
    modifiedModelPath,
    keepCurrentOriginalModel,
    keepCurrentModifiedModel,
    options,
  }: {
    original: string
    modified: string
    originalModelPath?: string
    modifiedModelPath?: string
    keepCurrentOriginalModel?: boolean
    keepCurrentModifiedModel?: boolean
    options?: {
      originalEditable?: boolean
      formatOnPaste?: boolean
      formatOnType?: boolean
      wordWrapOverride1?: string
      wordWrapOverride2?: string
      enableSplitViewResizing?: boolean
      splitViewDefaultRatio?: number
    }
  }) => (
    <div
      data-testid="diff-editor"
      data-original-editable={String(options?.originalEditable)}
      data-format-on-paste={String(options?.formatOnPaste)}
      data-format-on-type={String(options?.formatOnType)}
      data-word-wrap-override-1={String(options?.wordWrapOverride1)}
      data-word-wrap-override-2={String(options?.wordWrapOverride2)}
      data-enable-split-view-resizing={String(options?.enableSplitViewResizing)}
      data-split-view-default-ratio={String(options?.splitViewDefaultRatio)}
      data-original-model-path={originalModelPath}
      data-modified-model-path={modifiedModelPath}
      data-keep-current-original-model={String(keepCurrentOriginalModel)}
      data-keep-current-modified-model={String(keepCurrentModifiedModel)}
    >
      <textarea aria-label="original-code" value={original} readOnly />
      <textarea aria-label="modified-code" value={modified} readOnly />
    </div>
  ),
}))

function renderCodeDiff() {
  return render(
    <ToastProvider>
      <CodeDiff />
    </ToastProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('CodeDiff', () => {
  it('加载文件后应保留原始空白字符，不应提前规范化展示内容', async () => {
    renderCodeDiff()

    const originalText = 'function demo() {\n    return 1;   \n}\n\n'
    const modifiedText = 'function demo() {\n  return 2;\n}\n'

    fireEvent.change(screen.getByLabelText('加载原始文件'), {
      target: {
        files: [new File([originalText], 'original.js', { type: 'text/javascript' })],
      },
    })
    fireEvent.change(screen.getByLabelText('加载修改文件'), {
      target: {
        files: [new File([modifiedText], 'modified.js', { type: 'text/javascript' })],
      },
    })

    await waitFor(() => {
      expect(screen.getByLabelText('original-code')).toHaveValue(originalText)
      expect(screen.getByLabelText('modified-code')).toHaveValue(modifiedText)
    })
  })

  it('应显式开启左侧原始编辑区编辑，并关闭自动格式化', () => {
    renderCodeDiff()

    const diffEditor = screen.getByTestId('diff-editor')
    expect(diffEditor).toHaveAttribute('data-original-editable', 'true')
    expect(diffEditor).toHaveAttribute('data-format-on-paste', 'false')
    expect(diffEditor).toHaveAttribute('data-format-on-type', 'false')
  })

  it('左右侧编辑区都应开启换行展示', () => {
    renderCodeDiff()

    const diffEditor = screen.getByTestId('diff-editor')
    expect(diffEditor).toHaveAttribute('data-word-wrap-override-1', 'on')
    expect(diffEditor).toHaveAttribute('data-word-wrap-override-2', 'on')
  })

  it('分栏视图应默认左右等宽，并保留拖拽调整', () => {
    renderCodeDiff()

    const diffEditor = screen.getByTestId('diff-editor')
    expect(diffEditor).toHaveAttribute('data-enable-split-view-resizing', 'true')
    expect(diffEditor).toHaveAttribute('data-split-view-default-ratio', '0.5')
  })

  it('应使用稳定模型路径并保留当前模型，避免 DiffEditor 重建时提前释放 TextModel', () => {
    renderCodeDiff()

    const diffEditor = screen.getByTestId('diff-editor')
    expect(diffEditor).toHaveAttribute('data-original-model-path', 'inmemory://model/code-diff/original')
    expect(diffEditor).toHaveAttribute('data-modified-model-path', 'inmemory://model/code-diff/modified')
    expect(diffEditor).toHaveAttribute('data-keep-current-original-model', 'true')
    expect(diffEditor).toHaveAttribute('data-keep-current-modified-model', 'true')
  })

  it('重新挂载后应恢复两天内保存的左右文档内容', async () => {
    const { unmount } = renderCodeDiff()

    const originalText = 'const before = 1\n'
    const modifiedText = 'const after = 2\n'

    fireEvent.change(screen.getByLabelText('加载原始文件'), {
      target: {
        files: [new File([originalText], 'before.ts', { type: 'text/typescript' })],
      },
    })
    fireEvent.change(screen.getByLabelText('加载修改文件'), {
      target: {
        files: [new File([modifiedText], 'after.ts', { type: 'text/typescript' })],
      },
    })

    await waitFor(() => {
      expect(screen.getByLabelText('original-code')).toHaveValue(originalText)
      expect(screen.getByLabelText('modified-code')).toHaveValue(modifiedText)
    })

    unmount()
    renderCodeDiff()

    expect(screen.getByLabelText('original-code')).toHaveValue(originalText)
    expect(screen.getByLabelText('modified-code')).toHaveValue(modifiedText)
  })

  it('超过两天的保存内容应过期失效', () => {
    localStorage.setItem('dev-tools:code-diff:draft', JSON.stringify({
      value: {
        originalCode: 'old left',
        modifiedCode: 'old right',
        viewMode: 'split',
        language: 'plaintext',
        originalFileName: '',
        modifiedFileName: '',
        ignoreWhitespace: false,
      },
      expiresAt: Date.now() - 1,
    }))

    renderCodeDiff()

    expect(screen.getByLabelText('original-code')).toHaveValue('')
    expect(screen.getByLabelText('modified-code')).toHaveValue('')
  })
})
