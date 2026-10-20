import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { ToolDefinition } from '../tools/registry'
import { useDockMagnification } from '../hooks/useDockMagnification'
import ToolIcon from './ToolIcon'
import ToolSearchDialog from './ToolSearchDialog'
import forgeIcon from '../assets/tool-icons/forge.png'
import { ThemeProvider } from '../theme'
import { useAppTheme } from '../themeContext'

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
  const { theme, toggleTheme } = useAppTheme()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
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
  }, [location.pathname, reset])

  const showTooltip = (element: HTMLElement, key: string, label: string) => {
    if (!window.matchMedia?.('(min-width: 901px)').matches) return
    const rect = element.getBoundingClientRect()
    setTooltip({ key, label, left: rect.right + 12, top: Math.max(24, Math.min(window.innerHeight - 24, rect.top + rect.height / 2)) })
  }

  const openSearch = () => {
    reset()
    setTooltip(null)
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
        <div className="app-brand" aria-label="Forge 工具箱">
          <span className="app-brand-mark" aria-hidden="true"><ToolIcon src={forgeIcon} /></span>
          <span className="dock-sr-only">Forge 工具箱</span>
        </div>
        <nav ref={navRef} className="tool-dock" aria-label="工具导航" onPointerMove={onPointerMove} onPointerLeave={() => { onPointerLeave(); setTooltip(null) }} onPointerCancel={() => { reset(); setTooltip(null) }} onScroll={() => { reset(); setTooltip(null) }}>
          {tools.map((tool) => (
            <NavLink key={tool.path} data-tool-path={tool.path} to={tool.path} end={tool.path === '/'} aria-label={tool.navTitle} aria-describedby={tooltip?.key === tool.path ? tooltipId : undefined} className={({ isActive }) => `dock-item${isActive ? ' active' : ''}${tool.isTool === false ? ' dock-home' : ''}`} onPointerEnter={(event) => { if (event.pointerType !== 'touch') showTooltip(event.currentTarget, tool.path, tool.navTitle) }} onPointerLeave={() => setTooltip(null)} onFocus={(event) => showTooltip(event.currentTarget, tool.path, tool.navTitle)} onBlur={() => setTooltip(null)} onClick={() => setTooltip(null)}>
              <span className="dock-icon"><ToolIcon name={tool.icon} src={tool.iconSrc} /></span>
              <span className="dock-label">{tool.navTitle}</span>
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="dock-theme-toggle"
          aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          onClick={toggleTheme}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☼' : '☾'}</span>
          <span className="dock-theme-label">{theme === 'dark' ? '浅色' : '深色'}</span>
        </button>
        <button type="button" className="dock-search" aria-label="搜索工具" aria-haspopup="dialog" aria-expanded={isSearchOpen} aria-describedby={tooltip?.key === 'search' ? tooltipId : undefined} onClick={openSearch} onPointerEnter={(event) => { if (event.pointerType !== 'touch') showTooltip(event.currentTarget, 'search', '搜索工具 · ⌘K / Ctrl+K') }} onPointerLeave={() => setTooltip(null)} onFocus={(event) => showTooltip(event.currentTarget, 'search', '搜索工具 · ⌘K / Ctrl+K')} onBlur={() => setTooltip(null)}>
          <ToolIcon name="search" />
        </button>
      </aside>
      <main className="app-main">{children}</main>
      {tooltip && !isSearchOpen && createPortal(<div id={tooltipId} className="dock-tooltip" role="tooltip" style={{ left: tooltip.left, top: tooltip.top }}>{tooltip.label}</div>, document.body)}
      {isSearchOpen && <ToolSearchDialog tools={tools} onClose={() => setIsSearchOpen(false)} onSelect={selectTool} />}
    </div>
  )
}

const AppShell = (props: AppShellProps) => (
  <ThemeProvider>
    <AppShellContent {...props} />
  </ThemeProvider>
)

export default AppShell
