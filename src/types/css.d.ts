// CSS 模块类型声明
// 允许 TypeScript 识别 .css 文件的副作用导入
declare module '*.css' {
  const content: string
  export default content
}

// Vite ?inline 后缀的 CSS 导入（返回样式字符串，用于导出独立 HTML）
declare module '*.css?inline' {
  const content: string
  export default content
}
