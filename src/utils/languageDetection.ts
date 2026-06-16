/**
 * 语言检测工具模块
 * 从 CodeDiff 组件中提取，提供文件扩展名映射和代码内容语言检测功能
 */

// 语言检测映射（扩展名 -> Monaco 语言标识符）
const languageMap: Record<string, string> = {
  // JavaScript/TypeScript
  'js': 'javascript',
  'jsx': 'javascript',
  'mjs': 'javascript',
  'cjs': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'd.ts': 'typescript',
  
  // Python
  'py': 'python',
  'pyw': 'python',
  'pyi': 'python',
  
  // Java
  'java': 'java',
  'class': 'java',
  
  // C/C++
  'cpp': 'cpp',
  'cxx': 'cpp',
  'cc': 'cpp',
  'c++': 'cpp',
  'hpp': 'cpp',
  'hxx': 'cpp',
  'c': 'c',
  'h': 'c',
  
  // C#
  'cs': 'csharp',
  'csx': 'csharp',
  
  // PHP
  'php': 'php',
  'phtml': 'php',
  'php3': 'php',
  'php4': 'php',
  'php5': 'php',
  
  // Ruby
  'rb': 'ruby',
  'rbx': 'ruby',
  'rjs': 'ruby',
  'gemspec': 'ruby',
  'rake': 'ruby',
  
  // Go
  'go': 'go',
  
  // Rust
  'rs': 'rust',
  
  // Swift
  'swift': 'swift',
  
  // Kotlin
  'kt': 'kotlin',
  'kts': 'kotlin',
  
  // Scala
  'scala': 'scala',
  'sc': 'scala',
  
  // Shell
  'sh': 'shell',
  'bash': 'shell',
  'zsh': 'shell',
  'fish': 'shell',
  
  // SQL
  'sql': 'sql',
  
  // Web
  'html': 'html',
  'htm': 'html',
  'xhtml': 'html',
  'css': 'css',
  'scss': 'scss',
  'sass': 'scss',
  'less': 'less',
  
  // Data
  'json': 'json',
  'jsonc': 'json',
  'xml': 'xml',
  'yaml': 'yaml',
  'yml': 'yaml',
  
  // Markdown
  'md': 'markdown',
  'markdown': 'markdown',
  
  // Vue/Svelte
  'vue': 'vue',
  'svelte': 'svelte',
  
  // Other
  'dockerfile': 'dockerfile',
  'docker': 'dockerfile',
  'r': 'r',
  'rdata': 'r',
  'rds': 'r',
  'rmd': 'r',
  'lua': 'lua',
  'pl': 'perl',
  'pm': 'perl',
  'tcl': 'tcl',
  'dart': 'dart',
  'elm': 'elm',
  'ex': 'elixir',
  'exs': 'elixir',
  'clj': 'clojure',
  'cljs': 'clojure',
  'cljc': 'clojure',
  'edn': 'clojure',
  'hs': 'haskell',
  'lhs': 'haskell',
  'ml': 'ocaml',
  'mli': 'ocaml',
  'fs': 'fsharp',
  'fsi': 'fsharp',
  'fsx': 'fsharp',
  'vb': 'vb',
  'vbs': 'vb',
  'ps1': 'powershell',
  'psm1': 'powershell',
  'psd1': 'powershell',
  'bat': 'bat',
  'cmd': 'bat',
  'ini': 'ini',
  'toml': 'toml',
  'properties': 'properties',
  'conf': 'properties',
  'config': 'properties',
}

/**
 * 从文件名检测语言类型
 * @param fileName 文件名（含扩展名）
 * @returns Monaco 语言标识符，未匹配则返回 'plaintext'
 */
export function detectLanguageFromFileName(fileName: string): string {
  if (!fileName) return 'plaintext'
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return languageMap[ext] || 'plaintext'
}

/**
 * 从代码内容检测语言类型（基于代码特征，使用评分机制）
 * @param code 代码内容
 * @param fallbackLanguage 回退语言（当无法检测时使用），默认 'plaintext'
 * @returns Monaco 语言标识符
 */
export function detectLanguageFromContent(code: string, fallbackLanguage: string = 'plaintext'): string {
  if (!code || !code.trim()) return fallbackLanguage
  
  const trimmedCode = code.trim()
  const codeLines = trimmedCode.split('\n').slice(0, 50) // 只检查前50行以提高性能
  const codeLower = trimmedCode.toLowerCase()
  
  // 使用评分机制，每个语言累积分数
  const scores: Record<string, number> = {}
  
  // JSON 检测（优先级最高，因为特征明显）
  if (trimmedCode.startsWith('{') || trimmedCode.startsWith('[')) {
    try {
      JSON.parse(trimmedCode)
      return 'json'
    } catch {
      if (trimmedCode.match(/^\s*[{[]/)) {
        scores['json'] = (scores['json'] || 0) + 2
      }
    }
  }
  
  // HTML 检测（优先级高）
  if (trimmedCode.match(/<!DOCTYPE|<html|<head|<body|<div|<span|<p|<h[1-6]|<script|<style|<meta|<link/)) {
    scores['html'] = (scores['html'] || 0) + 10
  }
  if (codeLower.includes('</html>') || codeLower.includes('</body>')) {
    scores['html'] = (scores['html'] || 0) + 5
  }
  
  // XML 检测
  if (trimmedCode.match(/^<\?xml/)) {
    scores['xml'] = (scores['xml'] || 0) + 10
  }
  if (trimmedCode.match(/<[a-zA-Z]+[^>]*>/)) {
    scores['xml'] = (scores['xml'] || 0) + 3
  }
  
  // CSS 检测
  if (trimmedCode.match(/@media|@import|@keyframes|@charset|@font-face/)) {
    scores['css'] = (scores['css'] || 0) + 8
  }
  if (trimmedCode.match(/\{[^}]*:\s*[^}]*\}/)) {
    scores['css'] = (scores['css'] || 0) + 5
  }
  if (trimmedCode.match(/^[.#][a-zA-Z0-9_-]+\s*{/)) {
    scores['css'] = (scores['css'] || 0) + 3
  }
  
  // Shell/Bash 检测
  if (trimmedCode.match(/^#!\/bin\/(bash|sh|zsh|fish)/)) {
    scores['shell'] = (scores['shell'] || 0) + 10
  }
  if (trimmedCode.match(/^#!\/usr\/bin\/env\s+(bash|sh|zsh|fish)/)) {
    scores['shell'] = (scores['shell'] || 0) + 10
  }
  if (codeLines.some(line => line.match(/^(export|echo|if \[|for |while |function |#!)/))) {
    scores['shell'] = (scores['shell'] || 0) + 5
  }
  
  // SQL 检测
  const sqlKeywords = /(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|JOIN|INNER|OUTER|LEFT|RIGHT|GROUP BY|ORDER BY|HAVING|UNION|EXCEPT|INTERSECT)\s/i
  if (trimmedCode.match(sqlKeywords)) {
    scores['sql'] = (scores['sql'] || 0) + 8
  }
  if (codeLines.filter(line => sqlKeywords.test(line)).length > 2) {
    scores['sql'] = (scores['sql'] || 0) + 5
  }
  
  // Python 检测
  if (codeLines.some(line => line.match(/^(def |class |import |from |if __name__)/))) {
    scores['python'] = (scores['python'] || 0) + 8
  }
  if (codeLines.some(line => line.match(/print\s*\(|lambda |yield |async def |@/))) {
    scores['python'] = (scores['python'] || 0) + 5
  }
  if (codeLines.some(line => line.match(/^\s+[a-zA-Z_]/) && !line.includes(';'))) {
    scores['python'] = (scores['python'] || 0) + 2
  }
  
  // JavaScript/TypeScript 检测
  const jsKeywords = /(import|export|const|let|var|function|class|interface|type|=>|async|await)/
  if (codeLines.some(line => jsKeywords.test(line))) {
    const tsFeatures = /(:\s*(string|number|boolean|any|void|object|Array|Promise)|interface\s+\w+|type\s+\w+\s*=|as\s+\w+|<[A-Z]\w+>)/g
    const tsMatches = trimmedCode.match(tsFeatures)
    const jsMatches = trimmedCode.match(jsKeywords)
    
    if (tsMatches && tsMatches.length > 0) {
      scores['typescript'] = (scores['typescript'] || 0) + (tsMatches.length * 2)
    }
    if (jsMatches && jsMatches.length > 0) {
      scores['javascript'] = (scores['javascript'] || 0) + (jsMatches.length * 2)
    }
  }
  if (trimmedCode.match(/require\(|module\.exports|exports\./)) {
    scores['javascript'] = (scores['javascript'] || 0) + 5
  }
  
  // Java 检测
  if (codeLines.some(line => line.match(/^(public|private|protected|class|interface|package|import)\s/))) {
    scores['java'] = (scores['java'] || 0) + 8
  }
  if (codeLines.some(line => line.match(/@Override|@Deprecated|@SuppressWarnings/))) {
    scores['java'] = (scores['java'] || 0) + 5
  }
  if (trimmedCode.match(/public\s+(static\s+)?(void|int|String|boolean)\s+main\s*\(/)) {
    scores['java'] = (scores['java'] || 0) + 10
  }
  
  // C/C++ 检测
  if (codeLines.some(line => line.match(/^#include/))) {
    if (trimmedCode.match(/using\s+namespace|std::|cout|cin|endl|#include\s*<iostream>/)) {
      scores['cpp'] = (scores['cpp'] || 0) + 10
    } else {
      scores['c'] = (scores['c'] || 0) + 8
    }
  }
  if (trimmedCode.match(/#define|#ifdef|#ifndef|#pragma/)) {
    scores['c'] = (scores['c'] || 0) + 3
    scores['cpp'] = (scores['cpp'] || 0) + 3
  }
  
  // C# 检测
  if (codeLines.some(line => line.match(/^(using|namespace|public|private|class|interface)\s/))) {
    if (trimmedCode.match(/using\s+System|namespace\s+\w+|\[.*\]\s*(class|method)/)) {
      scores['csharp'] = (scores['csharp'] || 0) + 8
    }
  }
  
  // Go 检测
  if (codeLines.some(line => line.match(/^(package|import|func |var |const |type |go |defer )/))) {
    scores['go'] = (scores['go'] || 0) + 8
  }
  if (trimmedCode.match(/func\s+\w+\s*\(|:= |\.(String|Int|Bool)\(/)) {
    scores['go'] = (scores['go'] || 0) + 5
  }
  
  // Rust 检测
  if (codeLines.some(line => line.match(/^(fn |let |mut |pub |use |struct |enum |impl |trait )/))) {
    scores['rust'] = (scores['rust'] || 0) + 8
  }
  if (trimmedCode.match(/let\s+\w+:|-> |::|unwrap\(|expect\(/)) {
    scores['rust'] = (scores['rust'] || 0) + 5
  }
  
  // PHP 检测
  if (trimmedCode.match(/^<\?php|<\?=/)) {
    scores['php'] = (scores['php'] || 0) + 10
  }
  if (codeLines.some(line => line.match(/\$[a-zA-Z_]+|->|::|function\s+\w+\s*\(/))) {
    scores['php'] = (scores['php'] || 0) + 5
  }
  
  // Ruby 检测
  if (codeLines.some(line => line.match(/^(def |class |module |require |include |attr_)/))) {
    scores['ruby'] = (scores['ruby'] || 0) + 8
  }
  if (trimmedCode.match(/\.each\s*\{|\.map\s*\{|do\s+\|/)) {
    scores['ruby'] = (scores['ruby'] || 0) + 5
  }
  
  // YAML 检测
  if (codeLines.some(line => line.match(/^[a-zA-Z_][a-zA-Z0-9_]*:\s/)) && !trimmedCode.includes('{')) {
    scores['yaml'] = (scores['yaml'] || 0) + 5
  }
  if (trimmedCode.match(/^---|^\.\.\./)) {
    scores['yaml'] = (scores['yaml'] || 0) + 3
  }
  
  // Markdown 检测
  if (codeLines.some(line => line.match(/^#+\s|^\*\s|^-\s|^\d+\.\s/))) {
    scores['markdown'] = (scores['markdown'] || 0) + 5
  }
  if (trimmedCode.match(/\[.*\]\(.*\)|```|```/)) {
    scores['markdown'] = (scores['markdown'] || 0) + 3
  }
  
  // 找到得分最高的语言
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1])
  
  if (sortedScores.length > 0 && sortedScores[0][1] >= 5) {
    return sortedScores[0][0]
  }
  
  return fallbackLanguage
}
