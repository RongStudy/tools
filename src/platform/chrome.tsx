import { HashRouter } from 'react-router-dom'
import type { PlatformRouterComponent } from './types'

/**
 * 扩展页面由 chrome-extension:// 直接加载，没有服务端提供 history fallback，
 * 使用 HashRouter 才能保证扩展内刷新或直接访问子路径时定位正常。
 */
export const PlatformRouter: PlatformRouterComponent = ({ children }) => (
  <HashRouter>{children}</HashRouter>
)
