import { lazy, type ComponentType } from 'react'
import Home from '../pages/Home'
import type { ToolIconName } from '../components/ToolIcon'
import toolPaths from './paths.json'
import homeIcon from '../assets/tool-icons/home.png'
import jsonIcon from '../assets/tool-icons/json.png'
import diffIcon from '../assets/tool-icons/diff.png'
import regexIcon from '../assets/tool-icons/regex.png'
import codecIcon from '../assets/tool-icons/codec.png'
import diagramIcon from '../assets/tool-icons/diagram.png'
import clockIcon from '../assets/tool-icons/clock.png'
import noteIcon from '../assets/tool-icons/note.png'
import lottieIcon from '../assets/tool-icons/lottie.png'

const toolIcons: Record<ToolIconName, string | undefined> = {
  home: homeIcon,
  json: jsonIcon,
  diff: diffIcon,
  regex: regexIcon,
  codec: codecIcon,
  diagram: diagramIcon,
  clock: clockIcon,
  note: noteIcon,
  search: undefined,
  animation: lottieIcon,
}

const JsonFormatter = lazy(() => import('../pages/JsonFormatter'))
const CodeDiff = lazy(() => import('../pages/CodeDiff'))
const TimestampConverter = lazy(() => import('../pages/TimestampConverter'))
const UrlCodec = lazy(() => import('../pages/UrlCodec'))
const MermaidRenderer = lazy(() => import('../pages/MermaidRenderer'))
const RegexTester = lazy(() => import('../pages/RegexTester'))
const ScratchPad = lazy(() => import('../pages/ScratchPad'))
const LottiePlayer = lazy(() => import('../pages/LottiePlayer'))

export type ToolDefinition = {
  path: string
  title: string
  navTitle: string
  description: string
  category: string
  icon?: ToolIconName
  /** Imported image URL; takes precedence over the built-in placeholder icon. */
  iconSrc?: string
  component: ComponentType
  isTool?: boolean
}

const toolDefinitions: ToolDefinition[] = [
  {
    path: toolPaths.home,
    title: '首页',
    navTitle: '首页',
    description: '工具总览与快速入口',
    category: '总览',
    icon: 'home',
    component: Home,
    isTool: false,
  },
  {
    path: toolPaths.json,
    title: 'JSON格式化工具',
    navTitle: 'JSON格式化',
    description: '格式化、压缩、转义和解转义 JSON 内容',
    category: '编码处理',
    icon: 'json',
    component: JsonFormatter,
  },
  {
    path: toolPaths.codeDiff,
    title: '代码对比',
    navTitle: '代码对比',
    description: '对比两段代码或文件内容，支持分栏和统一视图',
    category: '编码处理',
    icon: 'diff',
    component: CodeDiff,
  },
  {
    path: toolPaths.regex,
    title: '正则表达式',
    navTitle: '正则表达式',
    description: '测试匹配、捕获组、替换和文本分割',
    category: '编码处理',
    icon: 'regex',
    component: RegexTester,
  },
  {
    path: toolPaths.urlCodec,
    title: '编解码',
    navTitle: '编解码',
    description: 'URL、Base64、Unicode 编解码与 MD5、SHA-256 摘要',
    category: '编码处理',
    icon: 'codec',
    component: UrlCodec,
  },
  {
    path: toolPaths.mermaid,
    title: 'Mermaid / Markdown 渲染',
    navTitle: 'Mermaid / Markdown',
    description: '自动识别 Mermaid 或 Markdown 内容并渲染',
    category: '编码处理',
    icon: 'diagram',
    component: MermaidRenderer,
  },
  {
    path: toolPaths.timestamp,
    title: '时间戳转换',
    navTitle: '时间戳转换',
    description: '查看当前时间戳，互转时间戳和日期时间',
    category: '时间工具',
    icon: 'clock',
    component: TimestampConverter,
  },
  {
    path: toolPaths.scratchPad,
    title: '临时文本输入',
    navTitle: '临时文本',
    description: '随手记录或粘贴文本，支持多标签、字号缩放和全屏编辑',
    category: '编码处理',
    icon: 'note',
    component: ScratchPad,
  },
  {
    path: toolPaths.lottie,
    title: 'Lottie 动画播放器',
    navTitle: 'Lottie 动画',
    description: '加载 URL 或 JSON 并预览 Lottie 动画',
    category: '多媒体工具',
    icon: 'animation',
    component: LottiePlayer,
  },
]

export const tools: ToolDefinition[] = toolDefinitions.map((tool) => ({
  ...tool,
  iconSrc: tool.iconSrc ?? (tool.icon ? toolIcons[tool.icon] : undefined),
}))
