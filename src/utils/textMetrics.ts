export const getTextMetrics = (text: string) => ({
  bytes: new TextEncoder().encode(text).length,
  lines: text ? text.split(/\r\n|\r|\n/).length : 0,
})

export const formatByteSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const describeSizeChange = (inputBytes: number, outputBytes: number) => {
  if (!inputBytes) return ''
  const change = (outputBytes - inputBytes) / inputBytes * 100
  if (change === 0) return '与输入等大'
  return `较输入${change < 0 ? '减少' : '增加'} ${Math.abs(change).toFixed(1)}%`
}
