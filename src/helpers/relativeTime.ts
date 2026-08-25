// Compact relative time for table cells: 12s ago, 4m ago, 3h ago, 2d ago.
export function formatRelative(date: Date, now: Date): string {
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
