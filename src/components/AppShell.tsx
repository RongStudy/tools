import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import type { ToolDefinition } from '../tools/registry'

type AppShellProps = {
  tools: ToolDefinition[]
  children: ReactNode
}

const groupToolsByCategory = (tools: ToolDefinition[]) => {
  return tools.reduce<Record<string, ToolDefinition[]>>((groups, tool) => {
    groups[tool.category] = groups[tool.category] || []
    groups[tool.category].push(tool)
    return groups
  }, {})
}

const getToolInitial = (tool: ToolDefinition) => {
  if (tool.path === '/json') return 'J'
  if (tool.path === '/code-diff') return 'D'
  if (tool.path === '/regex') return 'R'
  if (tool.path === '/url-codec') return 'U'
  if (tool.path === '/mermaid') return 'M'
  if (tool.path === '/timestamp') return 'T'
  return tool.navTitle.slice(0, 1)
}

const AppShell = ({ tools, children }: AppShellProps) => {
  const [query, setQuery] = useState('')
  const [isSidebarPinnedOpen, setIsSidebarPinnedOpen] = useState(false)
  const [isSidebarHovered, setIsSidebarHovered] = useState(false)
  const [isSidebarPreviewClosing, setIsSidebarPreviewClosing] = useState(false)
  const [isSidebarManuallyCollapsing, setIsSidebarManuallyCollapsing] = useState(false)
  const [isSidebarManuallyOpening, setIsSidebarManuallyOpening] = useState(false)
  const [isSidebarPreviewEnabled, setIsSidebarPreviewEnabled] = useState(true)
  const sidebarExitTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const sidebarManualTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const normalizedQuery = query.trim().toLowerCase()

  const clearSidebarExitTimer = () => {
    if (sidebarExitTimer.current !== null) {
      window.clearTimeout(sidebarExitTimer.current)
      sidebarExitTimer.current = null
    }
  }

  const clearSidebarManualTimer = () => {
    if (sidebarManualTimer.current !== null) {
      window.clearTimeout(sidebarManualTimer.current)
      sidebarManualTimer.current = null
    }
  }

  useEffect(() => () => {
    clearSidebarExitTimer()
    clearSidebarManualTimer()
  }, [])

  const handleSidebarMouseEnter = () => {
    clearSidebarExitTimer()
    setIsSidebarPreviewClosing(false)
    setIsSidebarHovered(true)
  }

  const handleSidebarMouseLeave = () => {
    if (isSidebarPinnedOpen) {
      setIsSidebarHovered(false)
      return
    }

    if (isSidebarManuallyCollapsing || isSidebarManuallyOpening) {
      setIsSidebarHovered(false)
      return
    }

    if (!isSidebarPreviewEnabled) {
      setIsSidebarHovered(false)
      setIsSidebarPreviewEnabled(true)
      return
    }

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setIsSidebarHovered(false)
      return
    }

    setIsSidebarPreviewClosing(true)
    sidebarExitTimer.current = window.setTimeout(() => {
      setIsSidebarHovered(false)
      setIsSidebarPreviewClosing(false)
      sidebarExitTimer.current = null
    }, 180)
  }

  const handleSidebarToggle = () => {
    clearSidebarExitTimer()
    clearSidebarManualTimer()
    setIsSidebarPreviewClosing(false)

    if (isSidebarPinnedOpen) {
      setIsSidebarHovered(false)
      setIsSidebarPreviewEnabled(false)
      setIsSidebarManuallyOpening(false)
      setIsSidebarManuallyCollapsing(true)
      setIsSidebarPinnedOpen(false)
      sidebarManualTimer.current = window.setTimeout(() => {
        setIsSidebarManuallyCollapsing(false)
        sidebarManualTimer.current = null
      }, 220)
      return
    }

    setIsSidebarHovered(false)
    setIsSidebarPreviewEnabled(true)
    setIsSidebarManuallyCollapsing(false)
    setIsSidebarManuallyOpening(true)
    setIsSidebarPinnedOpen(true)
    sidebarManualTimer.current = window.setTimeout(() => {
      setIsSidebarManuallyOpening(false)
      sidebarManualTimer.current = null
    }, 260)
  }

  const filteredTools = useMemo(() => {
    if (!normalizedQuery) return tools

    return tools.filter((tool) => {
      const searchableText = `${tool.title} ${tool.navTitle} ${tool.description} ${tool.category}`.toLowerCase()
      return searchableText.includes(normalizedQuery)
    })
  }, [normalizedQuery, tools])

  const groupedTools = useMemo(() => groupToolsByCategory(filteredTools), [filteredTools])

  return (
    <div
      className={[
        'app-shell',
        isSidebarPinnedOpen ? 'sidebar-pinned-open' : 'sidebar-collapsed',
        isSidebarHovered && !isSidebarPinnedOpen && isSidebarPreviewEnabled && !isSidebarManuallyCollapsing ? 'sidebar-hover-expanded' : '',
        isSidebarPreviewClosing && !isSidebarPinnedOpen ? 'sidebar-preview-closing' : '',
        isSidebarManuallyCollapsing ? 'sidebar-manual-collapsing' : '',
        isSidebarManuallyOpening ? 'sidebar-manual-opening' : '',
      ].filter(Boolean).join(' ')}
    >
      <aside
        className="app-sidebar"
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        <div className="app-sidebar-top">
          <div className="app-brand">
            <span className="app-brand-mark">F</span>
            <div className="app-brand-copy">
              <h1>Forge</h1>
              <p>{tools.filter((tool) => tool.isTool !== false).length} 个工具</p>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={handleSidebarToggle}
            aria-label={isSidebarPinnedOpen ? '收起侧边栏' : '展开侧边栏'}
            title={isSidebarPinnedOpen ? '收起侧边栏' : '展开侧边栏'}
          >
            {isSidebarPinnedOpen ? '‹' : '›'}
          </button>
        </div>

        <label className="tool-search">
          <span>搜索工具</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入名称或能力"
          />
        </label>

        <nav className="tool-nav" aria-label="工具导航">
          {Object.entries(groupedTools).map(([category, categoryTools]) => (
            <div className="tool-nav-group" key={category}>
              <div className="tool-nav-category">{category}</div>
              {categoryTools.map((tool) => (
                <NavLink
                  key={tool.path}
                  to={tool.path}
                  end={tool.path === '/'}
                  className={({ isActive }) => isActive ? 'tool-nav-link active' : 'tool-nav-link'}
                  title={tool.title}
                >
                  <span className="tool-nav-initial">{getToolInitial(tool)}</span>
                  <span className="tool-nav-copy">
                    <span>{tool.navTitle}</span>
                    <small>{tool.description}</small>
                  </span>
                </NavLink>
              ))}
            </div>
          ))}
          {filteredTools.length === 0 && (
            <div className="tool-nav-empty">没有匹配的工具</div>
          )}
        </nav>
      </aside>

      <main className="app-main">
        {children}
      </main>
    </div>
  )
}

export default AppShell
