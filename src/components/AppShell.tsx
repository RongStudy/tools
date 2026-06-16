import { useMemo, useState, type ReactNode } from 'react'
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
  if (tool.path === '/url-codec') return 'U'
  if (tool.path === '/timestamp') return 'T'
  return tool.navTitle.slice(0, 1)
}

const AppShell = ({ tools, children }: AppShellProps) => {
  const [query, setQuery] = useState('')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const normalizedQuery = query.trim().toLowerCase()

  const filteredTools = useMemo(() => {
    if (!normalizedQuery) return tools

    return tools.filter((tool) => {
      const searchableText = `${tool.title} ${tool.navTitle} ${tool.description} ${tool.category}`.toLowerCase()
      return searchableText.includes(normalizedQuery)
    })
  }, [normalizedQuery, tools])

  const groupedTools = useMemo(() => groupToolsByCategory(filteredTools), [filteredTools])

  return (
    <div className={isSidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <aside className="app-sidebar">
        <div className="app-sidebar-top">
          <div className="app-brand">
            <span className="app-brand-mark">T</span>
            <div className="app-brand-copy">
              <h1>开发工具</h1>
              <p>{tools.filter((tool) => tool.isTool !== false).length} 个工具</p>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            title={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {isSidebarCollapsed ? '›' : '‹'}
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
