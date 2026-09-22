import type { ComponentType, ReactNode } from 'react'

export interface PlatformRouterProps {
  children: ReactNode
}

/**
 * 平台路由容器。Web 与 Chrome 构建各自提供一份实现，
 * 由 vite.config.ts 的 `@platform` alias 在编译期选定。
 */
export type PlatformRouterComponent = ComponentType<PlatformRouterProps>
