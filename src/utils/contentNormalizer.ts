/**
 * 内容规范化工具模块
 * 从 CodeDiff 组件中提取，提供文件内容清理和缩进规范化功能
 */

/**
 * 规范化缩进（统一为2个空格基础单位）
 * @param content 文件内容
 * @returns 规范化后的内容
 */
export function normalizeIndent(content: string): string {
  const lines = content.split('\n')
  
  // 检测文件使用的基础缩进单位
  const indentSizes: number[] = []
  for (const line of lines) {
    if (line.trim().length === 0) continue
    const indentMatch = line.match(/^([ \t]+)/)
    if (indentMatch) {
      const indent = indentMatch[1]
      const tabCount = (indent.match(/\t/g) || []).length
      const spaceCount = indent.length - tabCount
      const totalSpaces = tabCount * 2 + spaceCount
      if (totalSpaces > 0 && totalSpaces <= 20) {
        indentSizes.push(totalSpaces)
      }
    }
  }
  
  // 找到最小的非零缩进作为基础单位
  const minIndent = indentSizes.length > 0 ? Math.min(...indentSizes.filter(s => s > 0)) : 2
  
  return lines.map(line => {
    if (line.trim().length === 0) return line
    
    const indentMatch = line.match(/^([ \t]+)/)
    if (!indentMatch) return line
    
    const indent = indentMatch[1]
    const tabCount = (indent.match(/\t/g) || []).length
    const spaceCount = indent.length - tabCount
    let totalSpaces = tabCount * 2 + spaceCount
    
    // 如果基础缩进是4，转换为2个空格基础单位
    if (minIndent === 4) {
      totalSpaces = totalSpaces / 2
    }
    
    // 统一为2个空格的倍数
    const indentLevel = Math.floor(totalSpaces / 2)
    const normalizedIndent = ' '.repeat(indentLevel * 2)
    
    return normalizedIndent + line.trimStart()
  }).join('\n')
}

/**
 * 清理文件内容（规范化内容以确保相同文件被识别为一致）
 * - 移除 BOM
 * - 规范化行尾符（统一为 \n）
 * - 规范化缩进（统一为2个空格）
 * - 移除每行末尾的空白字符
 * - 移除文件末尾的连续空行
 * @param content 原始文件内容
 * @returns 清理后的内容
 */
export function cleanFileContent(content: string): string {
  if (!content) return content
  
  // 移除 BOM (Byte Order Mark)
  let cleaned = content.replace(/^\uFEFF/, '')
  
  // 规范化行尾符（统一为 \n）
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  // 规范化缩进（统一为2个空格）
  cleaned = normalizeIndent(cleaned)
  
  // 移除每行末尾的空白字符
  cleaned = cleaned.split('\n').map(line => line.replace(/[ \t]+$/, '')).join('\n')
  
  // 移除文件末尾的连续空行（保留最后一个换行符）
  cleaned = cleaned.replace(/\n+$/, '\n')
  
  // 如果文件完全为空，返回空字符串
  if (cleaned.trim() === '') {
    return ''
  }
  
  return cleaned
}
