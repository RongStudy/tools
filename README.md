# Forge

面向日常工程操作的开发工具工作台，将文本编辑、数据处理、代码对比与图表预览集中在同一个界面中。提供 **Web 网页版、Chrome 扩展和跨平台独立程序** 三种使用方式。

[在线使用](https://rongstudy.github.io/tools/) · [版本发布](https://github.com/RongStudy/tools/releases) · [构建产物](https://github.com/RongStudy/tools/actions/workflows/deploy.yml) · [问题反馈](https://github.com/RongStudy/tools/issues)

## 功能一览

| 工具 | 主要能力 |
| --- | --- |
| JSON 格式化 | 格式化、压缩、转义、多层解转义、缩进设置、JSON Schema 校验、多文档标签、复制与自定义文件名导出 |
| 临时文本 | 多文档标签、每个文档最多 3 栏、语言自动识别、语法高亮、字号调整、curl 格式化、本地文件加载与保存 |
| 代码对比 | 分栏与统一视图、文件加载、语言自动识别、忽略空格、隐藏未修改内容、识别移动、多标签与全屏对比 |
| 编解码 | 参数值与完整 URL 编解码、Base64、Unicode 编解码、MD5 与 SHA-256 摘要 |
| 二维码 | HTTP/HTTPS 地址生成二维码、PNG 下载、通过上传/拖拽/粘贴图片识别 URL 或文本 |
| Mermaid / Markdown | 自动识别格式、实时预览、GFM、LaTeX 公式、Markdown 内嵌 Mermaid、本地文件加载、缩放与拖拽、全屏及 SVG/PNG/HTML 导出 |
| 时间戳转换 | 当前时间戳、秒与毫秒切换、时间戳与日期互转、常用时区选择，默认 Asia/Shanghai |
| 正则表达式 | 实时匹配、标志设置、捕获组、替换、文本分割与常用模板 |
| Lottie 动画 | 通过 URL 或 JSON 播放、加载后回显 JSON、内置示例、暂停与重播、循环及速度控制 |

### 工作台体验

- **双语界面**：支持中文与 English，首次使用默认为 English，可在设置中切换并记住偏好。
- **深浅主题**：编辑器与预览同步切换，设置立即生效并自动保存。
- **工具搜索**：按 `Cmd+K` / `Ctrl+K` 搜索和切换工具。
- **导航排序**：拖动导航图标、聚焦图标后按 `Alt+方向键`，或在设置中使用上下移按钮；首页固定在首位，支持恢复默认顺序。
- **编辑体验**：使用本地打包的 Monaco Editor，提供语法高亮；多个编辑页支持标签、可调整分栏和全屏查看。
- **自动草稿**：JSON、代码对比、临时文本和 Mermaid / Markdown 支持在当前浏览器中恢复草稿。

## 选择使用方式

| 方式 | 适用场景 | 如何开始 |
| --- | --- | --- |
| Web 网页版 | 直接打开即可使用 | 访问 [在线工作台](https://rongstudy.github.io/tools/) |
| Chrome 扩展 | 从浏览器工具栏快速打开 | 加载解压后的扩展目录，点击扩展图标打开工具页 |
| 独立程序 | 本地运行、离线使用核心工具 | 运行对应平台的可执行文件，再用浏览器访问本地地址 |

推荐使用电脑浏览器。当前不支持手机使用；平板页面宽度至少需要 **901px**，宽度不足时会提示切换横屏或使用电脑。

### 下载构建产物

当前工作流在推送到 `main` 后自动构建。打开 [GitHub Actions](https://github.com/RongStudy/tools/actions/workflows/deploy.yml)，选择对应提交的构建记录，在 **Artifacts** 中下载：

| Artifact 名称 | 内容 |
| --- | --- |
| `chrome-extension` | Chrome 扩展压缩包 |
| `forge-darwin-arm64` | macOS Apple Silicon 可执行文件 |
| `forge-darwin-amd64` | macOS Intel 可执行文件 |
| `forge-windows-amd64` | Windows x64 可执行文件 |
| `forge-windows-arm64` | Windows ARM64 可执行文件 |
| `forge-linux-amd64` | Linux x64 可执行文件 |

**Actions 的 Artifacts 与 Release 的 Assets 是两个独立位置。** 当前工作流不会在创建 tag 或发布 Release 时自动构建、上传附件；Release 中的编译包需要单独上传。页面中的 `Source code (zip)` 和 `Source code (tar.gz)` 是源码包，不是可执行程序。

### 安装 Chrome 扩展

1. 下载并解压扩展构建产物，或按下文执行 `npm run build:chrome`。
2. 找到直接包含 `manifest.json`、`background.js` 和 `index.html` 的目录。Actions 下载包内若还有 `chrome-extension.zip`，需继续解压。
3. 在 Chrome 中打开 `chrome://extensions/`，开启「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择上述目录；本地构建时为 `dist/chrome`。
5. 点击浏览器工具栏中的扩展图标，在新标签页打开完整工作台。

### 运行独立程序

选择与系统、CPU 架构相符的文件并解压。例如 macOS Apple Silicon：

```bash
chmod +x forge-darwin-arm64
./forge-darwin-arm64
```

Windows 可在 PowerShell 中运行，例如：

```powershell
.\forge-windows-amd64.exe
```

默认访问地址为 **http://127.0.0.1:8080/tools/**。程序只监听本机，不会自动打开浏览器；运行后手动访问终端显示的地址，按 `Ctrl+C` 停止服务。

可以通过 `-addr` 更改端口，例如：

```bash
./forge-darwin-arm64 -addr 127.0.0.1:9090
```

可执行文件已嵌入前端资源，运行时不需要 Node.js、Go 或额外的前端目录。核心工具可离线使用，远程资源仍需要网络。当前构建流程未提供 macOS 或 Windows 平台签名。

## 草稿、文件与网络访问

### 自动草稿与设置

- 「设置 → 外观主题」支持跟随系统、深色和浅色。未保存过主题偏好时默认跟随系统，浏览器报告的浅色或深色偏好变化时，界面会自动切换。

- 自动草稿默认开启，保存 **2 天**。在「设置 → 草稿保存」中可关闭自动保存或调整为 **1–365 天**。关闭后已有草稿仍按原时长保留。
- 点击「保存草稿设置」后，从下一次自动保存起使用新时长，每次保存重新计时；过期草稿在下次读取时清除。
- 自动草稿覆盖 JSON 格式化、代码对比、临时文本和 Mermaid / Markdown；其他工具不保证恢复输入内容。
- 在上述工具的选项菜单中选择「清除已保存草稿」，可删除该工具的本地草稿。当前编辑内容会保留，开启自动保存时，下次编辑后会重新保存。
- 草稿、语言、主题和菜单顺序保存在当前浏览器本地，不会上传到云端或跨设备同步。
- 清除网站数据会删除草稿。不同设备、浏览器、域名或端口使用不同的本地存储；需要长期留存的内容请导出文件备份。

### 本地文件编辑

临时文本和代码对比支持加载本地文本文件。在支持文件写回能力的浏览器中，可手动开启写回开关，选择文件并授权，再点击保存按钮写回原文件。

- 写回仅支持 UTF-8 文本，并保留原文件的 UTF-8 BOM。
- 保存前检查文件是否已被外部修改，发现冲突时提示重新加载，不覆盖外部修改。
- 文件句柄仅在当前页面会话中保留；恢复浏览器草稿不会恢复原文件的访问授权。
- 不支持写回时，仍可使用普通文件加载或导出功能。

Mermaid / Markdown 支持选择或拖入本地文档并预览，图表可导出 SVG/PNG，Markdown 可导出 HTML。

### 网络访问说明

文本处理、二维码生成与识别在浏览器本地完成；Monaco 编辑器及语言 Worker 随应用打包，不依赖 Monaco CDN。

加载远程 Lottie URL 会向指定地址请求动画 JSON，远程地址需允许跨域访问（CORS）。Markdown 中的远程图片、Lottie 引用的外部图片等资源也可能触发网络请求；使用离线内容时应一并准备这些资源。

## 本地开发

### 环境要求

- **Node.js 24** 与 npm：安装依赖、启动开发服务和构建前端，与 CI 保持一致。
- **Go 1.26**：仅在构建独立程序或验证 Go 启动器时需要。

```bash
git clone https://github.com/RongStudy/tools.git
cd tools
npm ci
npm run dev
```

默认开发地址为 `http://localhost:3000/tools/`，实际地址以终端输出为准。开发 Chrome target 可使用 `npm run dev:chrome`，加载到浏览器扩展中仍需先执行生产构建。

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Web 开发服务 |
| `npm run dev:chrome` | 启动 Chrome target 开发服务，使用 hash 路由 |
| `npm run build` / `npm run build:web` | 构建 Web，输出到 `dist/web` |
| `npm run build:chrome` | 构建 Chrome 扩展，输出到 `dist/chrome` |
| `npm run build:go` | 先构建 Web，再构建全部 5 种平台的独立程序，输出到 `dist/bin` |
| `npm run build:go -- --target linux/amd64` | 仅构建指定平台的独立程序，仍会先构建 Web |
| `npm run preview -- --outDir dist/web` | 预览已经构建的 Web 产物 |
| `npm run lint` | 执行 ESLint 检查 |
| `npm test` | 执行 Vitest 测试 |
| `npm run test:watch` | 以监听模式执行测试 |

预览 Web 产物前先运行 `npm run build:web`，随后访问预览服务地址下的 `/tools/` 路径。

Go 构建支持 `darwin/arm64`、`darwin/amd64`、`windows/amd64`、`windows/arm64` 和 `linux/amd64`，产物文件名与上表一致，Windows 文件带 `.exe` 后缀。例如本地构建的 Linux 版本位于 `dist/bin/forge-linux-amd64`。更多启动器说明见 [go/README.md](go/README.md)。

### 验证改动

前端改动后执行：

```bash
npm run lint
npm test
npm run build:web
npm run build:chrome
```

修改 Go 启动器后，在 `go/` 目录中执行：

```bash
gofmt -l .
go vet ./...
go test -race ./...
```

`gofmt -l .` 应无输出。涉及前端资源嵌入或跨平台构建的改动，还需在仓库根目录执行 `npm run build:go`。

### 依赖维护

ESLint 使用 `eslint.config.js` 平面配置。升级依赖后，除上述前端检查外，还应运行 `npm audit --registry=https://registry.npmjs.org`。

- `package.json` 通过 `overrides` 统一 Monaco 的 DOMPurify 和 Mermaid 的 KaTeX 版本。
- KaTeX 当前固定为 `0.18.10`，升级时需同时检查 `marked-katex-extension` 的兼容要求。
- `allowScripts` 按版本批准 esbuild 的安装脚本，禁止 fsevents 的安装脚本。升级 esbuild 后，应检查安装脚本并使用 `npm install-scripts approve esbuild` 更新批准记录。

## 构建与部署

Web 和 Chrome 共用页面、组件、工具注册表与测试，差异集中在 `vite.config.ts` 和平台适配模块中。Go 启动器嵌入 Web 构建产物，不维护另一套前端。

| 配置项 | Web | Chrome 扩展 |
| --- | --- | --- |
| Vite mode | `web` | `chrome` |
| 资源路径 `base` | `/tools/` | `./` |
| 路由 | `BrowserRouter` | `HashRouter` |
| 输出目录 | `dist/web` | `dist/chrome` |
| 扩展专属资源 | 不输出 | `manifest.json`、`background.js`、`icon.png` |
| Monaco | 本地 ESM 与语言 Worker | 本地 ESM 与语言 Worker |

- `@platform`、`@monaco-setup` alias 在编译期选择平台模块。
- Web 构建根据 `src/tools/paths.json` 生成各工具的静态入口，支持在 GitHub Pages 上直接打开或刷新子页面；部署位置需与 `/tools/` 资源路径及路由前缀匹配。
- Chrome 扩展采用 Manifest V3，构建时从 `package.json` 注入版本号。
- Go 构建将 `dist/web` 复制到嵌入目录，并使用 `CGO_ENABLED=0` 交叉编译；生成的前端快照与 `dist/` 均不提交源码。
- `.github/workflows/deploy.yml` 在推送 `main` 时分别部署 GitHub Pages、上传 Chrome 扩展和五个平台的 Go 构建产物。当前不包含 tag/Release 触发器或 Release 附件上传步骤。

## 项目结构

```text
.
├── .github/workflows/deploy.yml  # Pages 部署、Chrome 与 Go 构建
├── chrome/                      # Chrome 扩展清单、后台脚本与图标
├── go/                          # Go 独立启动器与 HTTP 测试
│   ├── cmd/forge/               # 命令行入口
│   └── internal/                # 服务生命周期、静态资源与嵌入目录
├── scripts/build-go.mjs         # 前端嵌入与跨平台编译
├── src/
│   ├── assets/                  # 工具图标与内置 Lottie 示例
│   ├── components/              # 导航、设置、编辑器和文件操作组件
│   ├── hooks/                   # 编辑器、草稿、文件与分栏逻辑
│   ├── locales/                 # English 界面文案
│   ├── monaco/                  # 本地编辑器、语言能力与 Schema 配置
│   ├── pages/                   # 首页与九款工具页面
│   ├── platform/                # Web / Chrome 路由适配
│   ├── tools/                   # 工具注册表与路径清单
│   ├── utils/                   # 格式化、渲染、存储与文件处理
│   └── workers/                 # JSON、正则与二维码任务 Worker
├── dist/                        # 构建产物：web/、chrome/、bin/（不提交）
├── DESIGN.md                    # UI 设计规范
├── LICENSE                      # MIT 许可证
├── package.json                 # 依赖与开发脚本
└── vite.config.ts               # 构建目标与测试配置
```

## 参与开发

欢迎通过 [Issues](https://github.com/RongStudy/tools/issues) 反馈问题或提出建议。报告问题时请附上使用方式（Web / Chrome / 独立程序）、浏览器版本、复现步骤及脱敏后的示例内容。

新增工具页时：

1. 在 `src/pages/` 下添加页面组件和样式，UI 遵循 [DESIGN.md](DESIGN.md)。
2. 在 `src/tools/paths.json` 登记路径，并在 `src/tools/registry.tsx` 注册工具信息与组件。
3. 复用 `ToolLayout`、`editor-panel`、`panel-header`、`panel-actions`、`btn` 等通用组件和样式。
4. 新增界面文案使用 `src/i18n.ts` 的翻译函数，并维护 `src/locales/en.json`。
5. 为新增行为补充测试，执行前端检查和两个 target 的构建；涉及 Go 启动器时再执行对应验证。

## 技术栈

React 18、TypeScript、Vite、React Router、Monaco Editor、Mermaid、Marked、KaTeX、Lottie、Vitest，以及用于独立程序的 Go 标准库。

## 许可证

本项目采用 [MIT License](LICENSE)，版权信息见许可证文件。
