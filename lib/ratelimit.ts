// ratelimit.ts — in-memory fixed-window limiter, keyed by client IP. Same
// single-machine assumption as the site: on multi-instance this silently stops
// working; do not deploy that way.
import { headers } from 'next/headers'

type HitWindow = { count: number; reset: number }

class RateLimiter {
  private hits = new Map<string, HitWindow>()
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string): boolean {
    const now = Date.now()
    if (this.hits.size > 4096) this.pruneExpired(now)

    const w = this.hits.get(key)
    if (!w || now > w.reset) {
      this.hits.set(key, { count: 1, reset: now + this.windowMs })
      return true
    }
    if (w.count >= this.limit) return false
    w.count++
    return true
  }

  private pruneExpired(now: number): void {
    for (const [k, w] of this.hits) {
      if (now > w.reset) this.hits.delete(k)
    }
  }
}

const g = globalThis as unknown as { __crmLoginRL?: RateLimiter }

// Throttle on the Google sign-in kickoff route.
export const loginRL: RateLimiter = (g.__crmLoginRL ??= new RateLimiter(10, 60_000))

// clientIP: behind Fly's proxy trust Fly-Client-IP, else the right-most
// (closest, trusted) X-Forwarded-For hop — never the spoofable left-most one.
export async function clientIP(): Promise<string> {
  const h = await headers()
  const fly = h.get('fly-client-ip')
  if (fly) return fly.trim()
  const xff = h.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return '127.0.0.1'
}
