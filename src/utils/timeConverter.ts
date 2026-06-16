export type TimestampUnit = 'seconds' | 'milliseconds'

export const DEFAULT_TIME_ZONE = 'Asia/Shanghai'

export const TIME_ZONE_OPTIONS = [
  'Asia/Shanghai',
  'UTC',
  'Asia/Tokyo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
] as const

export function getCurrentTimestamp(unit: TimestampUnit, now = Date.now()): string {
  return unit === 'seconds'
    ? Math.floor(now / 1000).toString()
    : now.toString()
}

export function timestampToDateTime(
  value: string,
  unit: TimestampUnit,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  const normalizedValue = value.trim()
  if (!normalizedValue) {
    throw new Error('请输入时间戳')
  }

  const timestamp = Number(normalizedValue)
  if (!Number.isFinite(timestamp)) {
    throw new Error('时间戳格式不正确')
  }

  const milliseconds = unit === 'seconds' ? timestamp * 1000 : timestamp
  const date = new Date(milliseconds)
  if (Number.isNaN(date.getTime())) {
    throw new Error('时间戳超出可转换范围')
  }

  return formatDateInTimeZone(date, timeZone)
}

export function dateTimeToTimestamp(
  value: string,
  timeZone = DEFAULT_TIME_ZONE,
  unit: TimestampUnit,
): string {
  const parsed = parseDateTimeParts(value)
  const utcMilliseconds = getUtcMillisecondsForTimeZone(parsed, timeZone)

  return unit === 'seconds'
    ? Math.floor(utcMilliseconds / 1000).toString()
    : utcMilliseconds.toString()
}

export function formatDateInTimeZone(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date)

  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${partMap.year}-${partMap.month}-${partMap.day} ${partMap.hour}:${partMap.minute}:${partMap.second}`
}

type DateTimeParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function parseDateTimeParts(value: string): DateTimeParts {
  const normalizedValue = value.trim()
  const match = normalizedValue.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  )

  if (!match) {
    throw new Error('日期时间格式应为 YYYY-MM-DD HH:mm:ss')
  }

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match
  const parsed = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  }

  const utcDate = new Date(Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute,
    parsed.second,
  ))

  if (
    utcDate.getUTCFullYear() !== parsed.year ||
    utcDate.getUTCMonth() !== parsed.month - 1 ||
    utcDate.getUTCDate() !== parsed.day ||
    utcDate.getUTCHours() !== parsed.hour ||
    utcDate.getUTCMinutes() !== parsed.minute ||
    utcDate.getUTCSeconds() !== parsed.second
  ) {
    throw new Error('日期时间不是有效值')
  }

  return parsed
}

function getUtcMillisecondsForTimeZone(parts: DateTimeParts, timeZone: string): number {
  let utcMilliseconds = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )

  // Apply offset twice to settle across daylight-saving transitions.
  for (let index = 0; index < 2; index += 1) {
    const offset = getTimeZoneOffsetMilliseconds(new Date(utcMilliseconds), timeZone)
    utcMilliseconds = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - offset
  }

  return utcMilliseconds
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date)

  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const asUtc = Date.UTC(
    Number(partMap.year),
    Number(partMap.month) - 1,
    Number(partMap.day),
    Number(partMap.hour),
    Number(partMap.minute),
    Number(partMap.second),
  )

  return asUtc - date.getTime()
}
