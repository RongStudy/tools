/**
 * 平台相关的 Monaco 初始化入口。
 * Web 和 Chrome 共用本地 ESM Monaco 实例，
 * 由 vite.config.ts 的 `@monaco-setup` alias 在编译期选定。
 */
export type MonacoSetup = () => Promise<void>
