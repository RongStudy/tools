# Forge

面向日常工程操作的开发工作台，提供格式化、代码对比、编解码、时间转换和图表渲染等功能。

## 功能特性

### 1. JSON 格式化工具
- ✅ JSON 格式化（美化）
- ✅ JSON 压缩
- ✅ JSON 转义
- ✅ 多层嵌套转义 JSON 的自动解转义
- ✅ 实时预览和错误提示
- ✅ 可自定义缩进（2空格/4空格/无缩进）
- ✅ 代码复制功能

### 2. 代码对比工具
- ✅ 分栏视图对比代码差异
- ✅ 统一视图显示差异（使用 Monaco DiffEditor）
- ✅ 从文件加载代码
- ✅ 代码复制功能
- ✅ 自动语言检测（基于文件扩展名）
- ✅ 支持多种编程语言（JavaScript、TypeScript、Python、Java、C++、Go、Rust 等）
- ✅ 多标签页支持，可同时打开多个对比任务
- ✅ Tab 内全屏模式，支持 ESC 键退出

### 3. 临时文本编辑器
- ✅ 多栏编辑，最多支持 3 个编辑栏同时显示
- ✅ 支持多种编程语言语法高亮
- ✅ 多标签页管理，可创建多个临时文本
- ✅ 字符计数显示
- ✅ 一键复制、清空功能
- ✅ 草稿自动保存（2 天有效期）

### 4. 时间戳转换工具
- ✅ 动态显示当前时间戳
- ✅ 支持秒级和毫秒级时间戳切换
- ✅ 支持时间戳转日期时间
- ✅ 支持日期时间转时间戳
- ✅ 支持常用时区选择，默认 Asia/Shanghai

### 5. URL 编解码工具
- ✅ URL 编码（encodeURIComponent）
- ✅ URL 解码（decodeURIComponent）
- ✅ Unicode 编解码支持
- ✅ 实时编解码预览
- ✅ 一键复制功能

### 6. 正则表达式测试工具
- ✅ 实时正则匹配测试
- ✅ 支持全局匹配、忽略大小写、多行模式等标志
- ✅ 高亮显示匹配结果
- ✅ 显示匹配组信息
- ✅ 常用正则表达式模板

### 7. Mermaid 渲染工具
- ✅ Mermaid 代码实时渲染
- ✅ 语法错误提示
- ✅ SVG、PNG 图表导出
- ✅ 50%–200% 缩放控制
- ✅ Tab 内全屏预览，支持 ESC 键退出
- ✅ 拖拽移动图表
- ✅ 草稿自动保留

### 8. 哈希计算工具
- ✅ MD5 哈希计算
- ✅ SHA-256 哈希计算
- ✅ 实时计算
- ✅ 一键复制结果

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Monaco Editor** - 代码编辑器（VS Code 编辑器核心）
- **Mermaid.js** - 图表解析与 SVG 渲染
- **React Router** - 路由管理

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

应用将在 `http://localhost:3000` 启动

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 项目结构

```
tool/
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
│   │   ├── MermaidRenderer.tsx   # Mermaid 渲染工具
│   │   └── MermaidRenderer.css
│   ├── components/
│   │   ├── AppShell.tsx          # 应用壳层与工具导航
│   │   ├── ToolLayout.tsx        # 工具页通用布局
│   │   └── Toast.tsx             # Toast 通知组件
│   ├── hooks/
│   │   └── useDiffEditor.ts      # Diff 编辑器 Hook
│   ├── tools/
│   │   └── registry.tsx          # 工具页注册表
│   ├── utils/
│   │   ├── clipboard.ts          # 剪贴板工具
│   │   ├── expiringStorage.ts    # 带过期时间的本地存储
│   │   └── languageDetection.ts  # 语言检测工具
│   ├── App.tsx                   # 主应用组件
│   ├── App.css
│   ├── main.tsx                  # 应用入口
│   └── index.css                 # 全局样式
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 新增工具页

1. 在 `src/pages/` 下创建页面组件和页面样式。
2. 在 `src/tools/registry.tsx` 中新增一条工具配置，填写 `path`、`title`、`navTitle`、`description`、`category` 和 `component`。
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
2. 使用 Monaco Editor 的内置 DiffEditor 查看代码差异
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
6. 草稿自动保存，2 天内重新打开仍可恢复

### Mermaid 渲染工具

1. 在编辑器中输入 Mermaid 图表代码
2. 预览区会实时渲染 SVG 图表
3. 使用缩放按钮调整图表大小（50%–200%）
4. 点击"全屏"按钮进入 Tab 内全屏模式查看大图，按 ESC 键退出
5. 支持拖拽移动图表位置
6. 点击"导出 SVG"或"导出 PNG"下载图表
7. 语法错误会在预览区显示详细错误信息

## 浏览器支持

- Chrome (最新版本)
- Firefox (最新版本)
- Safari (最新版本)
- Edge (最新版本)

## 许可证

MIT
