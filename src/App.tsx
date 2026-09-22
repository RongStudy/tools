import { Suspense, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PlatformRouter } from '@platform'
import { setupMonaco } from '@monaco-setup'
import { ToastProvider } from './components/Toast'
import AppShell from './components/AppShell'
import { tools } from './tools/registry'
import { suppressMonacoCancellationErrorLogs } from './utils/monacoErrorFilter'
import './App.css'
import './components/ToolLayout.css'
import './styles/common.css'

const CACHED_TOOL_PATHS = ['/json', '/code-diff', '/scratch-pad']

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
    const restoreConsoleError = suppressMonacoCancellationErrorLogs()
    setupMonaco()

    return restoreConsoleError
  }, [])

  return (
    <ToastProvider>
      <PlatformRouter>
        <AppShell tools={tools}>
          <Suspense fallback={<div className="tool-route-loading">工具加载中</div>}>
            <ToolRoutes />
          </Suspense>
        </AppShell>
      </PlatformRouter>
    </ToastProvider>
  )
}

export default App
