import type { ComponentType } from 'react'
import Home from '../pages/Home'
import JsonFormatter from '../pages/JsonFormatter'
import CodeDiff from '../pages/CodeDiff'
import TimestampConverter from '../pages/TimestampConverter'
import UrlCodec from '../pages/UrlCodec'

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
    path: '/url-codec',
    title: 'URL 编码/解码',
    navTitle: 'URL 编解码',
    description: 'URL Encode、URL Decode 参数值或完整 URL',
    category: '编码处理',
    component: UrlCodec,
  },
  {
    path: '/timestamp',
    title: '时间戳转换',
    navTitle: '时间戳转换',
    description: '查看当前时间戳，互转时间戳和日期时间',
    category: '时间工具',
    component: TimestampConverter,
  },
]
