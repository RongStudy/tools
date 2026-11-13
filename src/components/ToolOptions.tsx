import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { t, useLocale } from '../i18n'
import './ToolOptions.css'

type Props = { label?: string; children: ReactNode; count?: number; compact?: boolean; closeOnAction?: boolean }

export default function ToolOptions({ label, children, count = 0, compact = false, closeOnAction = false }: Props) {
  useLocale()
  const caption = label ?? t('选项')
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 480 })
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus({ preventScroll: true }) }

  useLayoutEffect(() => {
    if (!open || !trigger.current || !panel.current) return
    const anchor = trigger.current.getBoundingClientRect()
    const width = panel.current.getBoundingClientRect().width
    const maxHeight = Math.max(120, window.innerHeight - 24)
    const height = Math.min(panel.current.scrollHeight, maxHeight)
    const top = anchor.bottom + 8 + height <= window.innerHeight - 12 ? anchor.bottom + 8 : Math.max(12, anchor.top - height - 8)
    setPosition({ left: Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12)), top, maxHeight })
    panel.current.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false)
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true) }
    }
    const resize = () => setOpen(false)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', keydown, true)
    const focusOutside = (event: FocusEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false)
    }
    const scrollOutside = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(false)
    }
    const routePanel = trigger.current?.closest('.tool-route-panel')
    const observer = routePanel ? new MutationObserver(() => {
      if (routePanel.getAttribute('aria-hidden') === 'true') setOpen(false)
    }) : null
    if (routePanel) observer?.observe(routePanel, { attributes: true, attributeFilter: ['aria-hidden'] })
    document.addEventListener('focusin', focusOutside)
    document.addEventListener('scroll', scrollOutside, true)
    window.addEventListener('resize', resize)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', keydown, true)
      document.removeEventListener('focusin', focusOutside)
      document.removeEventListener('scroll', scrollOutside, true)
      observer?.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [open])

  return <>
    <button ref={trigger} type="button" className={compact ? 'btn-small tool-options-trigger' : 'btn btn-secondary tool-options-trigger'} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((value) => !value)}>
      <span className="tool-options-caption">{caption}</span>{count > 0 && <span className="tool-options-count" aria-label={t('已启用 {count} 项', { count })}>{count}</span>}<svg aria-hidden="true" className="tool-options-chevron" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open && createPortal(<div ref={panel} id={id} className="tool-options-panel" role="dialog" aria-label={caption} style={position} onClick={(event) => {
      const action = (event.target as HTMLElement).closest('button, a')
      if (closeOnAction && action && !action.hasAttribute('data-options-keep-open')) close(true)
    }} onKeyDown={(event) => {
      if (event.key !== 'Tab') return
      const controls = Array.from(panel.current?.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button, input, select, a[href]') ?? []).filter((control) => !control.disabled)
      if ((event.shiftKey && document.activeElement === controls[0]) || (!event.shiftKey && document.activeElement === controls[controls.length - 1])) { event.preventDefault(); close(true) }
    }}>
      <div className="tool-options-content">{children}</div>
    </div>, document.body)}
  </>
}
