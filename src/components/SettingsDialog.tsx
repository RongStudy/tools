import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { getDraftSettings, MAX_DRAFT_RETENTION_DAYS, setDraftSettings } from '../utils/expiringStorage'
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

const SettingsDialog = ({ onClose, tools, onMoveTool, onResetOrder, orderSaveFailed }: SettingsDialogProps) => {
  const { themePreference, setThemePreference } = useAppTheme()
  const locale = useLocale()
  const [initialDraftSettings] = useState(getDraftSettings)
  const [autosave, setAutosave] = useState(initialDraftSettings.enabled)
  const [days, setDays] = useState(() => String(initialDraftSettings.days))
  const [error, setError] = useState('')
  const autosaveRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLFormElement>(null)
  const titleId = useId()
  const inputId = useId()
  const helpId = useId()
  const errorId = useId()
  const themeTitleId = useId()
  const draftTitleId = useId()
  const languageTitleId = useId()
  const menuTitleId = useId()

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusTarget = inputRef.current?.disabled ? autosaveRef.current : inputRef.current
    focusTarget?.focus({ preventScroll: true })
    return () => { previousFocus?.focus() }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    } else if (event.key === 'Tab') {
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button') ?? []).filter((control) => !control.disabled)
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
    const value = autosave ? Number(days) : initialDraftSettings.days
    if (!Number.isInteger(value) || value < 1 || value > MAX_DRAFT_RETENTION_DAYS) {
      setError(t("请输入 1–{value0} 之间的整数天数", { value0: MAX_DRAFT_RETENTION_DAYS }))
      inputRef.current?.focus()
      return
    }
    if (!setDraftSettings({ enabled: autosave, days: value })) {
      setError(t("设置保存失败，请检查浏览器是否允许本地存储后重试"))
      return
    }
    onClose()
  }

  return createPortal(
    <div className="save-file-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form ref={dialogRef} className="save-file-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={save} onKeyDown={handleKeyDown} noValidate>
        <div className="settings-header">
          <h2 id={titleId}>{t("设置")}</h2>
          <button type="button" className="tool-search-close" aria-label={t("关闭设置")} onClick={onClose}>×</button>
        </div>
        <section className="settings-section" aria-labelledby={languageTitleId}>
          <h3 id={languageTitleId}>{t("界面语言")}</h3>
          <div className="settings-theme-options" role="group" aria-label={t("选择语言")}>
            <button type="button" className="btn btn-secondary" lang="en" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}><span aria-hidden="true">{locale === 'en' ? '✓ ' : ''}</span>English</button>
            <button type="button" className="btn btn-secondary" lang="zh-CN" aria-pressed={locale === 'zh'} onClick={() => setLocale('zh')}><span aria-hidden="true">{locale === 'zh' ? '✓ ' : ''}</span>{t("中文")}</button>
          </div>
          <p className="save-file-help">{t("语言切换立即生效，并自动记住。")}</p>
        </section>
        <section className="settings-section" aria-labelledby={themeTitleId}>
          <h3 id={themeTitleId}>{t("外观主题")}</h3>
          <div className="settings-theme-options" role="group" aria-label={t("选择主题")}>
            <button type="button" className="btn btn-secondary" aria-pressed={themePreference === 'system'} onClick={() => setThemePreference('system')}><span aria-hidden="true">{themePreference === 'system' ? '✓ ' : ''}</span>{t("跟随系统")}</button>
            <button type="button" className="btn btn-secondary" aria-pressed={themePreference === 'dark'} onClick={() => setThemePreference('dark')}><span aria-hidden="true">{themePreference === 'dark' ? '✓ ' : ''}</span>{t("深色主题")}</button>
            <button type="button" className="btn btn-secondary" aria-pressed={themePreference === 'light'} onClick={() => setThemePreference('light')}><span aria-hidden="true">{themePreference === 'light' ? '✓ ' : ''}</span>{t("浅色主题")}</button>
          </div>
          <p className="save-file-help">{t("主题切换立即生效，并自动记住，无需点击保存。")}</p>
        </section>
        <section className="settings-section" aria-labelledby={menuTitleId}>
          <div className="settings-menu-heading">
            <h3 id={menuTitleId}>{t('菜单顺序')}</h3>
            <button type="button" className="btn-small" onClick={onResetOrder}>{t('恢复默认顺序')}</button>
          </div>
          <p className="save-file-help">{t('拖动导航图标，或使用下方按钮排序。首页固定在首位，顺序自动保存到当前浏览器。')}</p>
          <ol className="settings-menu-list" aria-label={t('工具菜单顺序')}>
            {tools.map((tool, index) => <li key={tool.path} className="settings-menu-row">
              <span className="settings-menu-icon"><ToolIcon name={tool.icon} src={tool.iconSrc} /></span>
              <span className="settings-menu-name">{t(tool.navTitle)}</span>
              <button type="button" className="btn-small" disabled={index === 0} aria-label={t('上移 {tool}', { tool: t(tool.navTitle) })} onClick={() => onMoveTool(tool.path, tools[index - 1].path)}>↑</button>
              <button type="button" className="btn-small" disabled={index === tools.length - 1} aria-label={t('下移 {tool}', { tool: t(tool.navTitle) })} onClick={() => onMoveTool(tool.path, tools[index + 1].path)}>↓</button>
            </li>)}
          </ol>
          {orderSaveFailed && <p className="save-file-error" role="alert">{t('菜单顺序已调整，但保存失败，刷新后可能恢复默认。')}</p>}
        </section>
        <section className="settings-section" aria-labelledby={draftTitleId}>
          <h3 id={draftTitleId}>{t("草稿保存")}</h3>
          <label className="toggle-switch">
            <input ref={autosaveRef} type="checkbox" role="switch" checked={autosave} aria-describedby={helpId} onChange={(event) => { setAutosave(event.target.checked); setError('') }} />
            <span className="toggle-slider" aria-hidden="true" />
            <span className="toggle-label">{t("自动保存草稿")}</span>
          </label>
          <label htmlFor={inputId}>{t("草稿保存时长（天）")}</label>
          <input ref={inputRef} id={inputId} type="number" min={1} max={MAX_DRAFT_RETENTION_DAYS} step={1} value={days} disabled={!autosave} onChange={(event) => { setDays(event.target.value); setError('') }} aria-invalid={Boolean(error)} aria-describedby={error ? `${helpId} ${errorId}` : helpId} />
          <div id={helpId}>
            <p className="save-file-help">{t("默认 2 天，可设置 1–365 天。点击“保存草稿设置”后，从下一次自动保存起生效，每次保存重新计时。")}</p>
            <p className="save-file-help">{t("关闭后暂停写入新草稿。已有草稿可在对应工具的选项中清除。")}</p>
            <p className="save-file-help">{t("适用于 JSON 格式化、代码对比、临时文本和 Mermaid / Markdown 的自动草稿。")}</p>
            <p className="save-file-help">{t("草稿数据仅保存在当前浏览器本地，不会上传到云端。清除浏览器网站数据会删除本地草稿。")}</p>
          </div>
          {error && <p id={errorId} className="save-file-error" role="alert">{error}</p>}
        </section>
        <div className="save-file-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t("关闭")}</button>
          <button type="submit" className="btn btn-primary">{t("保存草稿设置")}</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

export default SettingsDialog
