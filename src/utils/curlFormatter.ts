const unsafeSyntax = '包含暂不支持的 Shell 结构，已保留原文'

const commandStart = (source: string) => {
  let index = 0
  while (index < source.length) {
    if (' \t\n'.includes(source[index])) { index++; continue }
    if (source[index] !== '#') break
    const end = source.indexOf('\n', index)
    index = end === -1 ? source.length : end + 1
  }
  return index
}

/** Detect the command itself, independently of the editor's selected language. */
export const isCurlCommand = (source: string) => /^curl(?:[ \t\n]|$)/.test(source.slice(commandStart(source)))

/**
 * Reflow one Bash curl command without decoding, reordering or interpreting its arguments.
 * Only word separators change; every shell word is copied verbatim. No curl option table
 * is needed, so unknown options, combined short flags and option=value forms work too.
 */
export function formatCurl(source: string): string {
  if (!isCurlCommand(source)) throw new Error('当前内容不是 curl 命令')
  if (source.includes('\0')) throw new Error(unsafeSyntax)

  const start = commandStart(source)
  const words: string[] = []
  let wordStart = -1
  let quote: 'single' | 'double' | 'ansi' | undefined
  let suffix = ''
  const finishWord = (end: number) => {
    if (wordStart !== -1) words.push(source.slice(wordStart, end))
    wordStart = -1
  }

  for (let index = start; index < source.length; index++) {
    const char = source[index]
    const next = source[index + 1]
    if (quote === 'single') {
      if (char === "'") quote = undefined
      continue
    }
    if (char === '\\') {
      if (next === undefined) throw new Error('命令末尾的转义不完整，已保留原文')
      if (quote || next !== '\n') {
        if (wordStart === -1) wordStart = index
      }
      index++
      continue
    }
    if (quote === 'ansi') {
      if (char === "'") quote = undefined
      continue
    }
    // Substitutions can contain arbitrary Shell grammar. Line-sensitive variables
    // would change value after reflow; neither can safely be treated as opaque text.
    if (char === '`' || (char === '$' && (next === '(' || next === '['))) throw new Error(unsafeSyntax)
    if (char === '$' && next === '{') {
      const end = source.indexOf('}', index + 2)
      const name = source.slice(index + 2, end)
      if (end === -1 || !/^(?:[a-zA-Z_][a-zA-Z0-9_]*|\d+|[@*?#$!_-])$/.test(name)
        || /^(?:LINENO|BASH_LINENO|BASH_COMMAND)$/.test(name)) throw new Error(unsafeSyntax)
      if (wordStart === -1) wordStart = index
      index = end
      continue
    }
    if (char === '$' && /^\$(?:LINENO|BASH_LINENO|BASH_COMMAND)\b/.test(source.slice(index))) throw new Error(unsafeSyntax)
    if (quote === 'double') {
      if (char === '"') quote = undefined
      continue
    }
    if (char === ' ' || char === '\t') { finishWord(index); continue }
    if (char === '\n' || (char === '#' && wordStart === -1)) {
      finishWord(index)
      const rest = source.slice(index)
      if (!rest.split('\n').every(line => /^[ \t]*(?:#.*)?$/.test(line))) throw new Error(unsafeSyntax)
      suffix = char === '#' ? ` ${rest}` : rest
      break
    }
    if (';&|<>()'.includes(char)) throw new Error(unsafeSyntax)
    if (wordStart === -1) wordStart = index
    if (char === "'") quote = 'single'
    else if (char === '"') quote = 'double'
    else if (char === '$' && next === "'") { quote = 'ansi'; index++ }
  }
  if (quote) throw new Error('引号未闭合，已保留原文')
  finishWord(source.length)

  // A visual break before a dash never assumes whether an option takes a value.
  // Even dash-prefixed values remain the exact same ordered shell words.
  const lines: string[] = []
  for (const word of words) {
    if (!lines.length || word.startsWith('-')) lines.push(word)
    else lines[lines.length - 1] += ` ${word}`
  }
  return source.slice(0, start) + lines.join(' \\\n  ') + suffix
}
