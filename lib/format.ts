// format.ts — display helpers. Money is stored as integer cents; it becomes a
// string at the last possible moment and never does float math.

export function money(cents: number | null | undefined): string {
  if (cents == null) return '—'
  const dollars = Math.trunc(cents / 100)
  return `$${dollars.toLocaleString('en-US')}`
}

// parseLocalDateTime turns form date + time fields into epoch seconds in the
// server's timezone (fly.toml pins TZ to the shop's timezone).
export function parseLocalDateTime(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const ms = new Date(`${date}T${time}:00`).getTime()
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000)
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
