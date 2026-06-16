# 开发工具集

一个基于 React + Vite + Monaco Editor 的前端开发工具集合，提供 JSON 格式化和代码对比功能。

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

### 3. 时间戳转换工具
- ✅ 动态显示当前时间戳
- ✅ 支持秒级和毫秒级时间戳切换
- ✅ 支持时间戳转日期时间
- ✅ 支持日期时间转时间戳
- ✅ 支持常用时区选择，默认 Asia/Shanghai

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Monaco Editor** - 代码编辑器（VS Code 编辑器核心）
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
│   │   ├── JsonFormatter.tsx    # JSON 格式化工具页面
│   │   ├── JsonFormatter.css
│   │   ├── CodeDiff.tsx         # 代码对比工具页面
│   │   ├── CodeDiff.css
│   │   ├── TimestampConverter.tsx # 时间戳转换工具页面
│   │   └── TimestampConverter.css
│   ├── components/
│   │   ├── AppShell.tsx          # 应用壳层与工具导航
│   │   ├── ToolLayout.tsx        # 工具页通用布局
│   │   └── Toast.tsx             # Toast 通知组件
│   ├── tools/
│   │   └── registry.tsx          # 工具页注册表
│   ├── App.tsx                   # 主应用组件
│   ├── App.css
│   ├── main.tsx                  # 应用入口
│   └── index.css                 # 全局样式
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

#### 统一视图模式
1. 切换到"统一视图"模式
2. 使用 Monaco Editor 的内置 DiffEditor 查看代码差异
3. 差异会以高亮方式显示，方便识别修改内容

## 浏览器支持

- Chrome (最新版本)
- Firefox (最新版本)
- Safari (最新版本)
- Edge (最新版本)

## 许可证

MIT
