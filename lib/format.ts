// format.ts — display helpers. Money is stored as integer cents; it becomes a
// string at the last possible moment and never does float math.

export function money(cents: number | null | undefined): string {
  if (cents == null) return '—'
  const dollars = Math.trunc(cents / 100)
  return `$${dollars.toLocaleString('en-US')}`
}

export function timeAgo(epochSeconds: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - epochSeconds)
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  return `${Math.floor(d / 30)}mo`
}

export function dateTimeShort(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
