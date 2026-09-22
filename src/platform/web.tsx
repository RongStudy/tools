import { BrowserRouter } from 'react-router-dom'
import type { PlatformRouterComponent } from './types'

/** 与 vite.config.ts 中 Web target 的 base 保持一致 */
export const WEB_BASENAME = '/tools'

export const PlatformRouter: PlatformRouterComponent = ({ children }) => (
  <BrowserRouter basename={WEB_BASENAME}>{children}</BrowserRouter>
)
