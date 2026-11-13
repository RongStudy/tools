import { t, useLocale } from '../i18n'
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
  useLocale()
  const metrics = useMemo(() => getTextMetrics(text), [text])
  return (
    <div className="editor-status-bar" aria-label={t("{value0}状态栏", { value0: label })}>
      <span className="editor-status-metrics">{metrics.lines.toLocaleString()} {t("行 ·")}{formatByteSize(metrics.bytes)}</span>
      <div className={`editor-status-message${error ? ' has-error' : ''}`}>
        {error && <span role="alert" title={error}>{error}</span>}
        {children}
      </div>
    </div>
  )
}
