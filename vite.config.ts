/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

type BuildTarget = 'web' | 'chrome'

const chromeDir = fileURLToPath(new URL('./chrome/', import.meta.url))
const packageJsonPath = fileURLToPath(new URL('./package.json', import.meta.url))

/** Chrome target 需要复制到产物根目录的扩展专属文件 */
const chromeExtensionFiles = ['manifest.json', 'background.js', 'icon.png'] as const

const resolveTarget = (mode: string): BuildTarget => (mode === 'chrome' ? 'chrome' : 'web')

/**
 * 把 chrome/ 下的扩展专属文件写进 Chrome 产物根目录。
 * 这些文件不放在共享 public/，避免 Web 构建也发布扩展清单和后台脚本。
 * manifest.json 的版本号统一取自 package.json，避免两处手动同步。
 */
const chromeExtensionAssets = (): Plugin => ({
  name: 'chrome-extension-assets',
  apply: 'build',
  generateBundle() {
    const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string }

    for (const fileName of chromeExtensionFiles) {
      const file = readFileSync(`${chromeDir}${fileName}`)
      const source = fileName === 'manifest.json'
        ? `${JSON.stringify({ ...JSON.parse(file.toString('utf8')), version }, null, 2)}\n`
        : file

      this.emitFile({ type: 'asset', fileName, source })
    }
  },
})

export default defineConfig(({ mode }) => {
  const target = resolveTarget(mode)
  const isChrome = target === 'chrome'

  return {
    // Web 版部署在 GitHub Pages 的 /tools/ 子路径下；
    // 扩展页由 chrome-extension:// 加载，必须使用相对资源路径。
    base: isChrome ? './' : '/tools/',
    plugins: [react(), ...(isChrome ? [chromeExtensionAssets()] : [])],
    resolve: {
      // 平台差异集中在 alias 选定的适配模块里，业务代码不感知运行环境。
      alias: {
        '@platform': fileURLToPath(new URL(`./src/platform/${target}.tsx`, import.meta.url)),
        '@monaco-setup': fileURLToPath(new URL(`./src/monaco/${target}.ts`, import.meta.url)),
      },
    },
    build: {
      // 两个 target 使用独立输出目录，避免产物互相覆盖或残留。
      outDir: isChrome ? 'dist/chrome' : 'dist/web',
    },
    server: {
      port: 3000,
      open: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
  }
})
