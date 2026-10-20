export type LottieData = {
  v: string
  fr: number
  ip: number
  op: number
  w: number
  h: number
  layers: unknown[]
  assets?: unknown[]
  fonts?: { list?: unknown[] }
  [key: string]: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)

export const validateLottieData = (value: unknown): LottieData => {
  if (!isRecord(value) || typeof value.v !== 'string' || !Array.isArray(value.layers)
    || !['fr', 'ip', 'op', 'w', 'h'].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]))
    || Number(value.fr) <= 0 || Number(value.w) <= 0 || Number(value.h) <= 0 || Number(value.op) <= Number(value.ip)) {
    throw new Error('不是有效的 Lottie JSON：需要 v、layers、正数 w / h / fr，以及 op > ip。')
  }
  if (value.assets !== undefined && !Array.isArray(value.assets)) throw new Error('Lottie assets 必须是数组。')
  return value as LottieData
}

export const parseLottieJson = (text: string): LottieData => {
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error('JSON 格式错误，请检查后重新播放。') }
  return validateLottieData(data)
}

export const parseAnimationUrl = (text: string): URL => {
  let url: URL
  try { url = new URL(text.trim()) } catch { throw new Error('请输入完整的 HTTP 或 HTTPS 动画链接。') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('只支持不含用户名和密码的 HTTP 或 HTTPS 动画链接。')
  }
  return url
}

// Lottie mutates animationData. Resolve resources on a fresh copy and keep the editor's JSON intact.
export const prepareLottieData = (source: LottieData, baseUrl: string): LottieData => {
  const data = JSON.parse(JSON.stringify(source)) as LottieData
  for (const asset of data.assets ?? []) {
    if (!isRecord(asset)) throw new Error('Lottie assets 中包含无效资源。')
    if (typeof asset.p !== 'string') continue
    if (/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(asset.p)) {
      asset.e = 1
      continue
    }
    const path = asset.e === 1 ? asset.p : `${typeof asset.u === 'string' ? asset.u : ''}${asset.p}`
    const url = parseAnimationUrl(new URL(path, baseUrl).href)
    asset.p = url.href
    asset.u = ''
    asset.e = 0
  }
  // The player can insert font URLs into CSS. Use glyphs or installed fonts for untrusted JSON.
  if (data.fonts?.list?.some((font) => isRecord(font) && font.fPath)) {
    throw new Error('此动画包含外部字体，请先将文字转为形状，或移除 fonts.list 中的 fPath 后播放。')
  }
  return data
}
