import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { getDraftSettings, isValidRetentionDays, MAX_DRAFT_RETENTION_DAYS, setDraftSettings } from '../utils/expiringStorage'
import { useAppTheme } from '../themeContext'
import { t, setLocale, useLocale } from '../i18n'
import type { ToolDefinition } from '../tools/registry'
import ToolIcon from './ToolIcon'
import './SaveFileDialog.css'
import './SettingsDialog.css'
import '../styles/common.css'

type SettingsDialogProps = {
  onClose: () => void
  tools: ToolDefinition[]
  onMoveTool: (source: string, target: string) => void
  onResetOrder: () => void
  orderSaveFailed: boolean
}

const themeOptions = [
  { value: 'system', label: '跟随系统' },
  { value: 'dark', label: '深色主题' },
  { value: 'light', label: '浅色主题' },
] as const

const SettingsDialog = ({ onClose, tools, onMoveTool, onResetOrder, orderSaveFailed }: SettingsDialogProps) => {
  const { themePreference, setThemePreference } = useAppTheme()
  const locale = useLocale()
  const [initialDraftSettings] = useState(getDraftSettings)
  const [autosave, setAutosave] = useState(initialDraftSettings.enabled)
  const [days, setDays] = useState(() => String(initialDraftSettings.days))
  const [saveFailed, setSaveFailed] = useState(false)
  const retentionDays = Number(days)
  const invalidDays = autosave && !isValidRetentionDays(retentionDays)
  const closeRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLFormElement>(null)
  const titleId = useId()
  const inputId = useId()
  const helpId = useId()
  const errorId = useId()
  const themeTitleId = useId()
  const draftTitleId = useId()
  const languageTitleId = useId()

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus({ preventScroll: true })
    return () => { previousFocus?.focus() }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    } else if (event.key === 'Tab') {
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button, input, summary') ?? [])
        .filter((control) => !control.matches(':disabled') && (control.matches('summary') || !control.closest('details:not([open])')))
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (invalidDays) {
      inputRef.current?.focus()
      return
    }
    if (!setDraftSettings({ enabled: autosave, days: autosave ? retentionDays : initialDraftSettings.days })) {
      setSaveFailed(true)
      return
    }
    onClose()
  }

  return createPortal(
    <div className="save-file-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form ref={dialogRef} className="save-file-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={save} onKeyDown={handleKeyDown} noValidate>
        <div className="settings-header">
          <h2 id={titleId}>{t("设置")}</h2>
          <button ref={closeRef} type="button" className="tool-search-close" aria-label={t("关闭设置")} onClick={onClose}>×</button>
        </div>
        <div className="settings-body">
          <div className="settings-section settings-preferences">
            <section className="settings-preference" aria-labelledby={languageTitleId}>
              <h3 id={languageTitleId}>{t("界面语言")}</h3>
              <div className="settings-segments" role="radiogroup" aria-labelledby={languageTitleId}>
                <label lang="en">
                  <input type="radio" name={languageTitleId} checked={locale === 'en'} onChange={() => setLocale('en')} />
                  <span>English</span>
                </label>
                <label lang="zh-CN">
                  <input type="radio" name={languageTitleId} checked={locale === 'zh'} onChange={() => setLocale('zh')} />
                  <span>{t("中文")}</span>
                </label>
              </div>
            </section>
            <section className="settings-preference" aria-labelledby={themeTitleId}>
              <h3 id={themeTitleId}>{t("外观主题")}</h3>
              <div className="settings-segments" role="radiogroup" aria-labelledby={themeTitleId}>
                {themeOptions.map(({ value, label }) => (
                  <label key={value}>
                    <input type="radio" name={themeTitleId} value={value} checked={themePreference === value} onChange={() => setThemePreference(value)} />
                    <span>{t(label)}</span>
                  </label>
                ))}
              </div>
            </section>
            <p className="save-file-help">{t("语言和外观立即生效，并自动保存。")}</p>
          </div>
          <details className="settings-section settings-menu">
            <summary>{t('菜单顺序')}</summary>
            <div className="settings-menu-actions">
              <p className="save-file-help">{t('拖动导航图标，或使用下方按钮排序。首页固定在首位，顺序自动保存到当前浏览器。')}</p>
              <button type="button" className="btn-small" onClick={onResetOrder}>{t('恢复默认顺序')}</button>
            </div>
            <ol className="settings-menu-list" aria-label={t('工具菜单顺序')}>
              {tools.map((tool, index) => <li key={tool.path} className="settings-menu-row">
                <span className="settings-menu-icon"><ToolIcon name={tool.icon} src={tool.iconSrc} /></span>
                <span className="settings-menu-name">{t(tool.navTitle)}</span>
                <button type="button" className="btn-small" disabled={index === 0} aria-label={t('上移 {tool}', { tool: t(tool.navTitle) })} onClick={() => onMoveTool(tool.path, tools[index - 1].path)}>↑</button>
                <button type="button" className="btn-small" disabled={index === tools.length - 1} aria-label={t('下移 {tool}', { tool: t(tool.navTitle) })} onClick={() => onMoveTool(tool.path, tools[index + 1].path)}>↓</button>
              </li>)}
            </ol>
            {orderSaveFailed && <p className="save-file-error" role="alert">{t('菜单顺序已调整，但保存失败，刷新后可能恢复默认。')}</p>}
          </details>
          <section className="settings-section settings-draft" aria-labelledby={draftTitleId}>
            <h3 id={draftTitleId}>{t("草稿保存")}</h3>
            <label className="toggle-switch">
              <input type="checkbox" role="switch" checked={autosave} aria-describedby={helpId} onChange={(event) => { setAutosave(event.target.checked); setSaveFailed(false) }} />
              <span className="toggle-slider" aria-hidden="true" />
              <span className="toggle-label">{t("自动保存草稿")}</span>
            </label>
            <div className="settings-retention">
              <label htmlFor={inputId}>{t("草稿保存时长（天）")}</label>
              <input ref={inputRef} id={inputId} type="number" min={1} max={MAX_DRAFT_RETENTION_DAYS} step={1} value={days} disabled={!autosave} onChange={(event) => { setDays(event.target.value); setSaveFailed(false) }} aria-invalid={invalidDays} aria-describedby={invalidDays ? `${errorId} ${helpId}` : helpId} />
            </div>
            {invalidDays && <p id={errorId} className="save-file-error" role="alert">{t("请输入 1–{value0} 之间的整数天数", { value0: MAX_DRAFT_RETENTION_DAYS })}</p>}
            <div id={helpId}>
              <p className="save-file-help">{t("默认 2 天，可设置 1–365 天。点击“保存草稿设置”后，从下一次自动保存起生效，每次保存重新计时。")}</p>
              <p className="save-file-help">{t("关闭后暂停写入新草稿。已有草稿可在对应工具的选项中清除。")}</p>
              <p className="save-file-help">{t("适用于 JSON 格式化、代码对比、临时文本和 Mermaid / Markdown 的自动草稿。")}</p>
              <p className="save-file-help">{t("草稿数据仅保存在当前浏览器本地，不会上传到云端。清除浏览器网站数据会删除本地草稿。")}</p>
            </div>
            {saveFailed && <p className="save-file-error" role="alert">{t("设置保存失败，请检查浏览器是否允许本地存储后重试")}</p>}
            <div className="save-file-actions">
              <button type="submit" className="btn btn-primary" disabled={invalidDays}>{t("保存草稿设置")}</button>
            </div>
          </section>
        </div>
      </form>
    </div>,
    document.body,
  )
}

export default SettingsDialog
