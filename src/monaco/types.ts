/**
 * 平台相关的 Monaco 初始化入口。
 * Web 走 CDN loader，Chrome 走打进扩展包的本地 Monaco 实例，
 * 由 vite.config.ts 的 `@monaco-setup` alias 在编译期选定。
 */
export type MonacoSetup = () => void
