# Forge

面向日常工程操作的开发工作台，提供格式化、代码对比、编解码、时间转换和图表渲染等功能。

## 在线使用

直接访问 **[https://rongstudy.github.io/tools](https://rongstudy.github.io/tools)** 即可使用，无需安装或启动本地服务。

建议使用电脑浏览器。当前暂不支持手机使用；平板需要至少 901px 的页面宽度，否则会提示切换横屏或使用电脑。

## 功能特性

| 工具 | 主要功能 |
| --- | --- |
| JSON 格式化 | 格式化、压缩、转义、多层解转义、缩进设置、JSON Schema 校验、多文档标签、复制与自定义文件名导出 |
| 代码对比 | 分栏与统一视图、文件加载、语言检测、忽略空格、识别移动、多标签与全屏对比 |
| 临时文本 | 多文档标签、每个文档最多 3 栏、语言检测与语法高亮、字号调整、curl 格式化、复制与保存本栏 |
| 时间戳转换 | 当前时间戳、秒与毫秒切换、时间戳与日期互转、常用时区选择（默认 Asia/Shanghai） |
| 编解码 | 参数值与完整 URL 编解码、Base64、Unicode 编解码、MD5 与 SHA-256 摘要 |
| 正则表达式 | 实时匹配、标志设置、捕获组、替换、文本分割与常用模板 |
| Mermaid / Markdown | 自动识别格式、实时渲染、GFM 与 LaTeX 公式、Markdown 内嵌 Mermaid、图表缩放与拖拽、全屏预览、图表及 Markdown HTML 导出 |
| Lottie 动画 | 通过 URL 或 JSON 播放、加载后回显 JSON、本地示例、暂停与重播、循环及速度控制 |

### 导航与设置

- 使用左侧工具栏切换工具，或按 `Cmd+K` / `Ctrl+K` 搜索工具。
- 点击工具栏底部的“设置”，分别管理“外观主题”和“草稿保存”。
- **外观主题**：支持深色与浅色，切换立即生效并自动记住，编辑器与预览同步切换主题。
- **草稿保存**：默认保存 **2 天**，可设置 **1–365 天**。点击“保存草稿设置”后，从下一次自动保存起使用新时长，每次保存重新计时；过期草稿在下次读取时清除。
- 自动草稿覆盖 JSON 格式化、代码对比、临时文本和 Mermaid / Markdown；其他工具不保证恢复输入内容。

### 本地保存说明

**自动草稿仅保存在当前浏览器本地，不会上传到云端。** 设置同样保存在本地；更换设备、浏览器或访问来源不会同步草稿，清除浏览器网站数据会删除本地草稿。需要长期留存的内容可导出文件备份。

Lottie 的 URL 加载会向用户指定的地址请求动画资源，远程地址需要允许跨域访问（CORS）。这与自动草稿的本地保存相互独立。

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Monaco Editor** - 代码编辑器（VS Code 编辑器核心）
- **Mermaid.js** - 图表解析与 SVG 渲染
- **React Router** - 路由管理

## 快速开始

### 安装依赖

使用 Node.js 24，与 CI 保持一致。

```bash
npm ci
```

ESLint 10 使用 `eslint.config.js` 平面配置。依赖升级后应执行 `npm run lint`、`npm test`、两个 target 的构建以及 `npm audit --registry=https://registry.npmjs.org`。

依赖兼容说明：Monaco 的 DOMPurify、Mermaid 的 KaTeX 通过 `overrides` 统一使用已修复版本；KaTeX 固定为 `0.18.10`，避免安装被弃用的 `0.18.11`，同时满足 Markdown 公式扩展的版本要求。

`package.json` 的 `allowScripts` 仅按版本批准 esbuild 的二进制安装脚本；macOS 可选依赖 fsevents 使用包内的预编译二进制，显式禁止其安装脚本。升级 esbuild 后，需检查新版脚本并运行 `npm install-scripts approve esbuild` 更新批准记录。

### 开发模式

```bash
npm run dev          # Web target，http://localhost:3000/tools/
npm run dev:chrome   # Chrome target，使用 hash 路由与本地 Monaco
```

### 构建生产版本

```bash
npm run build          # 等价于 build:web
npm run build:web      # Web 产物，输出到 dist/web，部署到 GitHub Pages 的 /tools/ 子路径
npm run build:chrome   # Chrome 扩展产物，输出到 dist/chrome
```

### 预览生产构建

```bash
npm run build:web
npm run preview -- --outDir dist/web
```

打开终端提示地址下的 `/tools/` 路径。

### 验证改动

```bash
npm run lint
npm test
npm run build:web
npm run build:chrome
```

推送到 `main` 后，GitHub Actions 会构建 Web 版本并部署到上述在线地址，同时构建 Chrome 扩展压缩包。

## 构建目标

两个 target 共用同一套页面、组件、工具注册表和测试，平台差异只在 Vite 配置和少量适配模块中：

| 配置项 | Web target | Chrome target |
|---|---|---|
| Vite mode | `web` | `chrome` |
| `base` | `/tools/` | `./` |
| 路由 | `BrowserRouter`（`src/platform/web.tsx`） | `HashRouter`（`src/platform/chrome.tsx`） |
| Monaco | 本地打包的 Monaco ESM 与语言 Worker | 本地打包的 Monaco ESM 与语言 Worker |
| 扩展文件 | 不输出 | 输出 `manifest.json`、`background.js`、`icon.png` |
| 输出目录 | `dist/web` | `dist/chrome` |

平台模块通过 `vite.config.ts` 中的 `@platform`、`@monaco-setup` alias 在编译期选定，业务代码不感知运行环境，也不做运行时环境探测。

Web 构建会根据 `src/tools/paths.json` 为每个工具生成 `<工具路径>/index.html`，确保 GitHub Pages 上直接访问或刷新子页面也能加载。工具注册表共用这份路径清单，新增工具时需在清单中登记路径。

两个 target 通过 `src/monaco/setup.ts` 按需加载同一套本地 Monaco 运行时（`src/monaco/runtime.ts`），均不依赖 Monaco CDN。

## Chrome 扩展

`dist/chrome` 是一个可直接加载的 Manifest V3 扩展：

1. 执行 `npm run build:chrome`；
2. 打开 `chrome://extensions/` 并开启「开发者模式」；
3. 点击「加载已解压的扩展程序」，选择 `dist/chrome` 目录；
4. 点击工具栏中的扩展图标，会在新标签页打开完整工具页。

实现说明：

- 扩展专属文件放在独立的 `chrome/` 目录，不放进共享 `public/`，避免 Web 产物也发布扩展清单；
- `manifest.json` 的 `version` 在构建时由 `package.json` 的 `version` 注入，无需两处手动同步；
- Manifest V3 禁止远程执行代码，因此 Chrome target 不使用 Monaco CDN，Worker 也随扩展包一起发布；
- 扩展页面没有服务端 history fallback，必须使用 hash 路由。

## 项目结构

```
tool/
├── chrome/                       # Chrome 扩展专属文件，仅在 build:chrome 时输出
│   ├── manifest.json
│   ├── background.js
│   └── icon.png
├── src/
│   ├── pages/
│   │   ├── Home.tsx              # 首页
│   │   ├── JsonFormatter.tsx     # JSON 格式化工具
│   │   ├── JsonFormatter.css
│   │   ├── CodeDiff.tsx          # 代码对比工具
│   │   ├── CodeDiff.css
│   │   ├── ScratchPad.tsx        # 临时文本编辑器
│   │   ├── ScratchPad.css
│   │   ├── TimestampConverter.tsx # 时间戳转换工具
│   │   ├── TimestampConverter.css
│   │   ├── UrlCodec.tsx          # URL 编解码工具
│   │   ├── UrlCodec.css
│   │   ├── RegexTester.tsx       # 正则表达式测试工具
│   │   ├── RegexTester.css
│   │   ├── MermaidRenderer.tsx   # Mermaid / Markdown 渲染
│   │   ├── MermaidRenderer.css
│   │   ├── LottiePlayer.tsx      # Lottie 动画播放器
│   │   └── LottiePlayer.css
│   ├── components/
│   │   ├── AppShell.tsx          # 应用壳层与工具导航
│   │   ├── SettingsDialog.tsx    # 外观主题与草稿保存设置
│   │   ├── ToolLayout.tsx        # 工具页通用布局
│   │   └── Toast.tsx             # Toast 通知组件
│   ├── hooks/
│   │   └── useDiffEditor.ts      # Diff 编辑器 Hook
│   ├── platform/                 # 路由等平台适配，按 target 二选一
│   │   ├── types.ts              # 平台模块契约
│   │   ├── web.tsx               # BrowserRouter + /tools basename
│   │   └── chrome.tsx            # HashRouter
│   ├── monaco/                   # 平台入口与共用本地 Monaco 运行时
│   │   ├── types.ts              # 平台模块契约
│   │   ├── web.ts                # Web 初始化入口
│   │   ├── chrome.ts             # Chrome 初始化入口
│   │   ├── setup.ts              # 按需初始化与失败重试
│   │   └── runtime.ts            # 共用本地 Monaco + 语言 Worker
│   ├── tools/
│   │   ├── paths.json            # 共用路径与 Web 静态入口清单
│   │   └── registry.tsx          # 工具页注册表
│   ├── types/
│   │   ├── css.d.ts              # CSS 导入类型声明
│   │   └── worker.d.ts           # Vite ?worker 导入类型声明
│   ├── utils/
│   │   ├── clipboard.ts          # 剪贴板工具
│   │   ├── expiringStorage.ts    # 带过期时间的本地存储
│   │   └── languageDetection.ts  # 语言检测工具
│   ├── App.tsx                   # 主应用组件
│   ├── App.css
│   ├── main.tsx                  # 应用入口
│   └── index.css                 # 全局样式
├── public/                       # Web 与 Chrome 共用的静态资源
├── dist/
│   ├── web/                      # build:web 产物
│   └── chrome/                   # build:chrome 产物
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── README.md
```

## 新增工具页

1. 在 `src/pages/` 下创建页面组件和页面样式。
2. 在 `src/tools/paths.json` 中登记路径，再在 `src/tools/registry.tsx` 中新增工具配置，填写 `path`、`title`、`navTitle`、`description`、`category` 和 `component`。
3. 页面内优先使用 `ToolLayout`、`editor-panel`、`panel-header`、`panel-actions`、`btn` 等已有布局和样式类，保持工具页交互一致。

## 使用说明

### JSON 格式化工具

1. 在左侧编辑器中输入或粘贴 JSON 代码
2. 选择缩进大小（2空格/4空格/无缩进）
3. 点击相应按钮：
   - **格式化**：美化 JSON 代码
   - **压缩**：移除所有空格和换行
   - **转义**：将 JSON 字符串转义
   - **解转义**：自动解转义多层嵌套的 JSON 字符串
4. 右侧编辑器会实时显示格式化后的结果
5. 点击"复制"按钮可复制代码到剪贴板

### 代码对比工具

#### 分栏视图模式

1. 在左侧编辑器中输入原始代码
2. 在右侧编辑器中输入修改后的代码
3. 可以点击"加载文件"按钮从文件系统加载代码
4. 选择对应的编程语言（或使用自动检测）
5. 使用"交换"按钮可以交换左右两侧的代码
6. 点击"全屏"按钮进入 Tab 内全屏模式，按 ESC 键退出

#### 统一视图模式

1. 切换到"统一视图"模式
2. 查看逐行差异文本；新增行以 `+` 标记，删除行以 `-` 标记
3. 差异会以高亮方式显示，方便识别修改内容

#### 多标签页管理

1. 点击"新建对比"创建新的对比标签页
2. 每个标签页独立保存对比内容
3. 点击标签右侧的关闭按钮删除对应标签页

### 临时文本编辑器

1. 支持多栏编辑模式，点击"新增栏"可添加编辑栏（最多 3 栏）
2. 每栏可独立选择编程语言，享受语法高亮
3. 支持多标签页，可创建多个临时文本文档
4. 实时显示字符计数
5. 点击"复制"快速复制当前栏内容
6. 草稿自动保存，默认 2 天内重新打开仍可恢复；可在“设置 → 草稿保存”中调整时长，从下一次自动保存起生效，每次保存重新计时。草稿仅保存在当前浏览器本地，不会上传到云端；清除网站数据会删除草稿。

### Mermaid / Markdown 渲染

支持自动识别内容，也可手动选择 Mermaid 或 Markdown 模式。Markdown 支持 GFM、LaTeX 数学公式和内嵌 Mermaid 图表，可导出 HTML。Mermaid 模式使用方式：

1. 在编辑器中输入 Mermaid 图表代码
2. 预览区会实时渲染 SVG 图表
3. 使用缩放按钮调整图表大小（50%–200%）
4. 点击"全屏"按钮进入 Tab 内全屏模式查看大图，按 ESC 键退出
5. 支持拖拽移动图表位置
6. 点击"导出 SVG"或"导出 PNG"下载图表
7. 语法错误会在预览区显示详细错误信息

### Lottie 动画播放器

1. 选择内置示例，或粘贴动画 JSON 后点击“播放 JSON”。
2. 也可输入 HTTP(S) 动画 URL，点击“加载并播放”；成功读取后会在编辑器中回显 JSON。
3. 使用预览区控件暂停、重播、设置循环或调整速度。
4. 若远程地址不允许跨域读取，可将 JSON 直接粘贴到编辑器中播放。

## 浏览器支持

- Chrome (最新版本)
- Firefox (最新版本)
- Safari (最新版本)
- Edge (最新版本)

## 许可证

MIT
