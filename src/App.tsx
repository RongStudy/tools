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
  const needsMonaco = [...CACHED_TOOL_PATHS, '/mermaid'].includes(activePath)
  const [monacoReady, setMonacoReady] = useState(false)
  const [monacoError, setMonacoError] = useState(false)
  const [initializationAttempt, setInitializationAttempt] = useState(0)
  const retryMonaco = () => setInitializationAttempt((attempt) => attempt + 1)

  useEffect(() => {
    if (!needsMonaco || monacoReady) return
    let cancelled = false
    setMonacoError(false)
    void setupMonaco().then(() => {
      if (!cancelled) setMonacoReady(true)
    }).catch(() => {
      if (!cancelled) setMonacoError(true)
    })
    return () => { cancelled = true }
  }, [needsMonaco, monacoReady, initializationAttempt])
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

  if (!monacoReady && [...CACHED_TOOL_PATHS, '/mermaid'].includes(activePath)) {
    return monacoError ? (
      <div className="tool-route-loading" role="alert">
        编辑器加载失败 <button className="btn-small" onClick={retryMonaco}>重试</button>
      </div>
    ) : <div className="tool-route-loading" role="status">编辑器加载中</div>
  }

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
  useEffect(() => suppressMonacoCancellationErrorLogs(), [])

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
