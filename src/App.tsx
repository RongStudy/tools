import { t, useLocale } from './i18n'
import { Suspense, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PlatformRouter } from '@platform'
import { setupMonaco } from '@monaco-setup'
import { ToastProvider } from './components/Toast'
import AppShell from './components/AppShell'
import MobileAccessNotice from './components/MobileAccessNotice'
import { getDeviceKind, TABLET_MIN_WIDTH } from './utils/device'
import { tools } from './tools/registry'
import { ThemeProvider } from './theme'
import { suppressMonacoCancellationErrorLogs } from './utils/monacoErrorFilter'
import './App.css'
import './components/ToolLayout.css'
import './styles/common.css'

const CACHED_TOOL_PATHS = ['/json', '/code-diff', '/scratch-pad', '/mermaid']

const isCachedToolPath = (path: string) => CACHED_TOOL_PATHS.includes(path)

const ToolRoutes = () => {
  useLocale()
  const location = useLocation()
  const activePath = location.pathname.replace(/\/+$/, '') || '/'
  const needsMonaco = isCachedToolPath(activePath) || activePath === '/lottie'
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
  const UncachedTool = !isCachedToolPath(activePath)
    ? tools.find((tool) => tool.path === activePath)?.component
    : undefined

  useEffect(() => {
    if (!isCachedToolPath(activePath)) return

    setMountedCachedPaths((paths) => (
      paths.includes(activePath) ? paths : [...paths, activePath]
    ))
  }, [activePath])

  if (!monacoReady && needsMonaco) {
    return monacoError ? (
      <div className="tool-route-loading" role="alert">
        {t("编辑器加载失败")}<button className="btn-small" onClick={retryMonaco}>{t("重试")}</button>
      </div>
    ) : <div className="tool-route-loading" role="status">{t("编辑器加载中")}</div>
  }

  return (
    <div className="tool-route-stack">
      {cachedTools.map(({ path, component: ToolComponent }) => {
        const isActive = activePath === path

        return (
          <div
            key={path}
            className={isActive ? 'tool-route-panel active' : 'tool-route-panel'}
            aria-hidden={!isActive}
            ref={(panel) => { if (panel) panel.inert = !isActive }}
          >
            <ToolComponent />
          </div>
        )
      })}
      {UncachedTool && (
        <div key={activePath} className="tool-route">
          <UncachedTool />
        </div>
      )}
    </div>
  )
}

function App() {
  useLocale()
  useEffect(() => suppressMonacoCancellationErrorLogs(), [])
  const [device] = useState(getDeviceKind)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)

  useEffect(() => {
    if (device !== 'tablet') return
    const updateWidth = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [device])

  if (device === 'phone' || (device === 'tablet' && viewportWidth < TABLET_MIN_WIDTH)) {
    return (
      <ThemeProvider>
        <MobileAccessNotice tablet={device === 'tablet'} />
      </ThemeProvider>
    )
  }

  return (
    <ToastProvider>
      <PlatformRouter>
        <AppShell tools={tools}>
          <Suspense fallback={<div className="tool-route-loading">{t("工具加载中")}</div>}>
            <ToolRoutes />
          </Suspense>
        </AppShell>
      </PlatformRouter>
    </ToastProvider>
  )
}

export default App
