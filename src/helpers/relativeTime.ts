// Locale-aware "5 min ago" over Intl.RelativeTimeFormat.

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

export function relativeTime(unixMs: number, locale: string, now = Date.now()): string {
  const seconds = Math.round((unixMs - now) / 1000)
  const abs = Math.abs(seconds)
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' })
  for (const [unit, size] of STEPS) {
    if (abs >= size) return fmt.format(Math.trunc(seconds / size), unit)
  }
  return fmt.format(seconds, 'second')
}
