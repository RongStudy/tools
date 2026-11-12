import { useMemo, type ReactNode } from 'react'
import { formatByteSize, getTextMetrics } from '../utils/textMetrics'
import './EditorStatusBar.css'

type EditorStatusBarProps = {
  text: string
  label: string
  error?: string
  children?: ReactNode
}

export default function EditorStatusBar({ text, label, error, children }: EditorStatusBarProps) {
  const metrics = useMemo(() => getTextMetrics(text), [text])
  return (
    <div className="editor-status-bar" aria-label={`${label}状态栏`}>
      <span className="editor-status-metrics">{metrics.lines.toLocaleString()} 行 · {formatByteSize(metrics.bytes)}</span>
      <div className={`editor-status-message${error ? ' has-error' : ''}`}>
        {error && <span role="alert" title={error}>{error}</span>}
        {children}
      </div>
    </div>
  )
}
