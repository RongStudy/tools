import { t, useLocale } from '../i18n'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { ToolDefinition } from '../tools/registry'
import { useDockMagnification } from '../hooks/useDockMagnification'
import { useToolOrder } from '../hooks/useToolOrder'
import ToolIcon from './ToolIcon'
import ToolSearchDialog from './ToolSearchDialog'
import SettingsDialog from './SettingsDialog'
import { ThemeProvider } from '../theme'

type AppShellProps = {
  tools: ToolDefinition[]
  children: ReactNode
}

type Tooltip = {
  key: string
  label: string
  left: number
  top: number
}

const AppShellContent = ({ tools, children }: AppShellProps) => {
  useLocale()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [dragPath, setDragPath] = useState<string | null>(null)
  const [dropPath, setDropPath] = useState<string | null>(null)
  const { orderedTools, movableTools, moveTool, resetOrder, saveFailed, announcement } = useToolOrder(tools)
  const tooltipId = useId()
  const { navRef, onPointerMove, onPointerLeave, reset } = useDockMagnification()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        event.stopPropagation()
        setTooltip(null)
        reset()
        setIsSettingsOpen(false)
        setIsSearchOpen((open) => !open)
      } else if (event.key === 'Escape') {
        setTooltip(null)
      }
    }
    const hideTooltip = () => setTooltip(null)
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('resize', hideTooltip)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('resize', hideTooltip)
    }
  }, [reset])

  useEffect(() => {
    setTooltip(null)
    reset()
  }, [location.pathname, orderedTools, reset])

  const showTooltip = (element: HTMLElement, key: string, label: string) => {
    if (!window.matchMedia?.('(min-width: 901px)').matches) return
    const rect = element.getBoundingClientRect()
    setTooltip({ key, label, left: rect.right + 12, top: Math.max(24, Math.min(window.innerHeight - 24, rect.top + rect.height / 2)) })
  }

  const openSearch = () => {
    reset()
    setTooltip(null)
    setIsSettingsOpen(false)
    setIsSearchOpen(true)
  }

  const selectTool = (tool: ToolDefinition) => {
    navigate(tool.path)
    setIsSearchOpen(false)
    const links = navRef.current?.querySelectorAll<HTMLElement>('.dock-item')
    Array.from(links ?? []).find((link) => link.dataset.toolPath === tool.path)?.focus()
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <nav ref={navRef} className="tool-dock" aria-label={t("工具导航")} onPointerMove={(event) => { if (!dragPath) onPointerMove(event) }} onPointerLeave={() => { onPointerLeave(); setTooltip(null) }} onPointerCancel={() => { reset(); setTooltip(null) }} onScroll={() => { reset(); setTooltip(null) }}>
          {orderedTools.map((tool) => (
            <NavLink key={tool.path} data-tool-path={tool.path} to={tool.path} end={tool.path === '/'} aria-label={t(tool.navTitle)} aria-describedby={tooltip?.key === tool.path ? tooltipId : undefined} className={({ isActive }) => `dock-item${isActive ? ' active' : ''}${tool.isTool === false ? ' dock-home' : ''}${dragPath === tool.path ? ' dock-dragging' : ''}${dropPath === tool.path ? ' dock-drop-target' : ''}`}
              draggable={tool.isTool !== false} title={tool.isTool !== false ? t('拖动排序，或按 Alt + 方向键调整') : undefined}
              onDragStart={(event) => {
                if (tool.isTool === false) { event.preventDefault(); return }
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', tool.path)
                reset(); setTooltip(null); setDragPath(tool.path)
              }}
              onDragOver={(event) => {
                if (!dragPath || tool.isTool === false || tool.path === dragPath) return
                event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropPath(tool.path)
              }}
              onDragLeave={() => setDropPath((current) => current === tool.path ? null : current)}
              onDrop={(event) => {
                if (!dragPath || tool.isTool === false) return
                event.preventDefault(); moveTool(dragPath, tool.path); setDragPath(null); setDropPath(null)
              }}
              onDragEnd={() => { setDragPath(null); setDropPath(null) }}
              onKeyDown={(event) => {
                if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing || tool.isTool === false) return
                const delta = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : 0
                if (!delta) return
                event.preventDefault()
                const target = movableTools[movableTools.findIndex((item) => item.path === tool.path) + delta]
                if (target) { moveTool(tool.path, target.path); setTooltip(null) }
              }}
              onPointerEnter={(event) => { if (!dragPath && event.pointerType !== 'touch') showTooltip(event.currentTarget, tool.path, t(tool.navTitle)) }} onPointerLeave={() => setTooltip(null)} onFocus={(event) => showTooltip(event.currentTarget, tool.path, t(tool.navTitle))} onBlur={() => setTooltip(null)} onClick={() => setTooltip(null)}>
              <span className="dock-icon"><ToolIcon name={tool.icon} src={tool.iconSrc} /></span>
              <span className="dock-label">{t(tool.navTitle)}</span>
            </NavLink>
          ))}
        </nav>
        <button type="button" className="dock-search" aria-label={t("搜索工具")} aria-haspopup="dialog" aria-expanded={isSearchOpen} aria-describedby={tooltip?.key === 'search' ? tooltipId : undefined} onClick={openSearch} onPointerEnter={(event) => { if (event.pointerType !== 'touch') showTooltip(event.currentTarget, 'search', t("搜索工具 · ⌘K / Ctrl+K")) }} onPointerLeave={() => setTooltip(null)} onFocus={(event) => showTooltip(event.currentTarget, 'search', t("搜索工具 · ⌘K / Ctrl+K"))} onBlur={() => setTooltip(null)}>
          <ToolIcon name="search" />
        </button>
        <button type="button" className="dock-search" aria-label={t("设置")} title={t("设置")} aria-haspopup="dialog" aria-expanded={isSettingsOpen} onClick={() => { reset(); setTooltip(null); setIsSearchOpen(false); setIsSettingsOpen(true) }}>
          <ToolIcon name="settings" />
        </button>
      </aside>
      <main className="app-main">{children}</main>
      {tooltip && !isSearchOpen && createPortal(<div id={tooltipId} className="dock-tooltip" role="tooltip" style={{ left: tooltip.left, top: tooltip.top }}>{tooltip.label}</div>, document.body)}
      {isSearchOpen && <ToolSearchDialog tools={tools} onClose={() => setIsSearchOpen(false)} onSelect={selectTool} />}
      {isSettingsOpen && <SettingsDialog onClose={() => setIsSettingsOpen(false)} tools={movableTools} onMoveTool={moveTool} onResetOrder={resetOrder} orderSaveFailed={saveFailed} />}
      <div className="dock-sr-only" role="status" aria-live="polite">{saveFailed ? t('菜单顺序已调整，但保存失败，刷新后可能恢复默认。') : announcement}</div>
    </div>
  )
}

const AppShell = (props: AppShellProps) => {
  useLocale()
  return (
  <ThemeProvider>
    <AppShellContent {...props} />
  </ThemeProvider>
  )
}

export default AppShell
