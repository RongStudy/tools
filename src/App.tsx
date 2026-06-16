import { useEffect, useState } from 'react'
import { loader } from '@monaco-editor/react'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import AppShell from './components/AppShell'
import { tools } from './tools/registry'
import './App.css'
import './components/ToolLayout.css'
import './styles/common.css'

const CACHED_TOOL_PATHS = ['/json', '/code-diff']

const isCachedToolPath = (path: string) => CACHED_TOOL_PATHS.includes(path)

const ToolRoutes = () => {
  const location = useLocation()
  const activePath = location.pathname.replace(/\/+$/, '') || '/'
  const [mountedCachedPaths, setMountedCachedPaths] = useState<string[]>(() => (
    isCachedToolPath(activePath) ? [activePath] : []
  ))
  const cachedTools = tools.filter((tool) => (
    isCachedToolPath(tool.path) && (
      mountedCachedPaths.includes(tool.path) || tool.path === activePath
    )
  ))
  const activeTool = tools.find((tool) => tool.path === activePath)

  useEffect(() => {
    if (!isCachedToolPath(activePath)) return

    setMountedCachedPaths((paths) => (
      paths.includes(activePath) ? paths : [...paths, activePath]
    ))
  }, [activePath])

  if (!isCachedToolPath(activePath)) {
    if (!activeTool) return null

    const ToolComponent = activeTool.component
    return (
      <div className="tool-route">
        <ToolComponent />
      </div>
    )
  }

  return (
    <div className="tool-route-stack">
      {cachedTools.map(({ path, component: ToolComponent }) => {
        const isActive = path === '/' ? activePath === '/' : activePath === path

        return (
          <div
            key={path}
            className={isActive ? 'tool-route-panel active' : 'tool-route-panel'}
            aria-hidden={!isActive}
          >
            <ToolComponent />
          </div>
        )
      })}
    </div>
  )
}

function App() {
  useEffect(() => {
    void loader.init()
  }, [])

  return (
    <ToastProvider>
      <BrowserRouter basename="/tools">
        <AppShell tools={tools}>
          <ToolRoutes />
        </AppShell>
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App
