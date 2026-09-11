import type { ComponentType } from 'react'
import Home from '../pages/Home'
import JsonFormatter from '../pages/JsonFormatter'
import CodeDiff from '../pages/CodeDiff'
import TimestampConverter from '../pages/TimestampConverter'
import UrlCodec from '../pages/UrlCodec'
import MermaidRenderer from '../pages/MermaidRenderer'
import RegexTester from '../pages/RegexTester'
import ScratchPad from '../pages/ScratchPad'

export type ToolDefinition = {
  path: string
  title: string
  navTitle: string
  description: string
  category: string
  component: ComponentType
  isTool?: boolean
}

export const tools: ToolDefinition[] = [
  {
    path: '/',
    title: '首页',
    navTitle: '首页',
    description: '工具总览与快速入口',
    category: '总览',
    component: Home,
    isTool: false,
  },
  {
    path: '/json',
    title: 'JSON格式化工具',
    navTitle: 'JSON格式化',
    description: '格式化、压缩、转义和解转义 JSON 内容',
    category: '编码处理',
    component: JsonFormatter,
  },
  {
    path: '/code-diff',
    title: '代码对比',
    navTitle: '代码对比',
    description: '对比两段代码或文件内容，支持分栏和统一视图',
    category: '编码处理',
    component: CodeDiff,
  },
  {
    path: '/regex',
    title: '正则表达式',
    navTitle: '正则表达式',
    description: '测试匹配、捕获组、替换和文本分割',
    category: '编码处理',
    component: RegexTester,
  },
  {
    path: '/url-codec',
    title: '编解码',
    navTitle: '编解码',
    description: 'URL、Base64、Unicode 编解码与 MD5、SHA-256 摘要',
    category: '编码处理',
    component: UrlCodec,
  },
  {
    path: '/mermaid',
    title: 'Mermaid / Markdown 渲染',
    navTitle: 'Mermaid / Markdown',
    description: '自动识别 Mermaid 或 Markdown 内容并渲染',
    category: '编码处理',
    component: MermaidRenderer,
  },
  {
    path: '/timestamp',
    title: '时间戳转换',
    navTitle: '时间戳转换',
    description: '查看当前时间戳，互转时间戳和日期时间',
    category: '时间工具',
    component: TimestampConverter,
  },
  {
    path: '/scratch-pad',
    title: '临时文本输入',
    navTitle: '临时文本',
    description: '随手记录或粘贴文本，支持多标签、字号缩放和全屏编辑',
    category: '编码处理',
    component: ScratchPad,
  },
]
