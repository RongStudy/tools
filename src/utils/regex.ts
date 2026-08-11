export const REGEX_FLAG_ORDER = ['d', 'g', 'i', 'm', 's', 'u', 'v', 'y'] as const

export type RegexFlag = typeof REGEX_FLAG_ORDER[number]

export type RegexMatch = {
  value: string
  index: number
  end: number
  groups: Array<string | null>
  namedGroups: Record<string, string | null>
  groupIndices: Array<[number, number] | null>
  namedGroupIndices: Record<string, [number, number] | null>
}

export type RegexTaskInput = {
  pattern: string
  flags: string
  text: string
  replacement: string
  splitLimit: number
  maxMatches?: number
}

export type RegexTaskResult = {
  matches: RegexMatch[]
  replacement: string
  splitItems: string[]
  truncated: boolean
  durationMs: number
}

type MatchIndices = Array<[number, number] | undefined> & {
  groups?: Record<string, [number, number] | undefined>
}

type MatchWithIndices = RegExpExecArray & {
  indices?: MatchIndices
}

const toNullableRecord = (groups?: Record<string, string>) => {
  return Object.fromEntries(
    Object.entries(groups ?? {}).map(([name, value]) => [name, value ?? null])
  )
}

const toNullableIndices = (indices?: Array<[number, number] | undefined>) => {
  return (indices ?? []).map((range) => range ?? null)
}

const advanceStringIndex = (text: string, index: number, unicode: boolean) => {
  if (!unicode || index + 1 >= text.length) return index + 1

  const first = text.charCodeAt(index)
  if (first < 0xd800 || first > 0xdbff) return index + 1

  const second = text.charCodeAt(index + 1)
  return second >= 0xdc00 && second <= 0xdfff ? index + 2 : index + 1
}

export const normalizeRegexFlags = (flags: Iterable<string>) => {
  const selected = new Set(flags)
  return REGEX_FLAG_ORDER.filter((flag) => selected.has(flag)).join('')
}

export const evaluateRegex = ({
  pattern,
  flags,
  text,
  replacement,
  splitLimit,
  maxMatches = 1000,
}: RegexTaskInput): RegexTaskResult => {
  const startedAt = performance.now()
  const regex = new RegExp(pattern, flags)
  const matches: RegexMatch[] = []
  const shouldContinue = regex.global
  let truncated = false
  let match: RegExpExecArray | null

  do {
    match = regex.exec(text)
    if (!match) break

    const indexedMatch = match as MatchWithIndices
    const namedGroupIndices = Object.fromEntries(
      Object.entries(indexedMatch.indices?.groups ?? {}).map(([name, range]) => [name, range ?? null])
    )

    matches.push({
      value: match[0],
      index: match.index,
      end: match.index + match[0].length,
      groups: match.slice(1).map((value) => value ?? null),
      namedGroups: toNullableRecord(match.groups),
      groupIndices: toNullableIndices(indexedMatch.indices?.slice(1)),
      namedGroupIndices,
    })

    if (matches.length >= maxMatches) {
      const nextMatch = shouldContinue ? regex.exec(text) : null
      truncated = Boolean(nextMatch)
      break
    }

    if (shouldContinue && match[0] === '') {
      regex.lastIndex = advanceStringIndex(text, regex.lastIndex, regex.unicode)
    }
  } while (shouldContinue)

  const replacementRegex = new RegExp(pattern, flags)
  const splitRegex = new RegExp(pattern, flags)

  return {
    matches,
    replacement: text.replace(replacementRegex, replacement),
    splitItems: text.split(splitRegex, Math.max(0, splitLimit)),
    truncated,
    durationMs: performance.now() - startedAt,
  }
}
