// health.ts — site health alerts (roadmap #4). The patient never takes its
// own pulse: the CRM polls the marketing site's /healthz, and an external
// uptime checker can also report in through /api/webhooks/health. Both paths
// share one state machine so they can't double-alert, and pushes fire only on
// transitions — down once, up once, never every poll while it stays down.
import { broadcastPush } from './push'
import { siteHealthURL } from './env'

const POLL_MS = 60_000
const FAILS_TO_ALERT = 3 // one blip is a blip; three misses in a row is down

type HealthState = { timer?: NodeJS.Timeout; failures: number; down: boolean }

const g = globalThis as unknown as { __crmHealth?: HealthState }
const state: HealthState = (g.__crmHealth ??= { failures: 0, down: false })

export function startHealthLoop(): void {
  const url = siteHealthURL()
  if (!url) return // unset ⇒ polling disabled, webhook path still works
  if (state.timer) return
  state.timer = setInterval(() => void poll(url), POLL_MS)
  state.timer.unref?.()
}

async function poll(url: string): Promise<void> {
  let ok = false
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    ok = res.ok
  } catch {
    ok = false
  }
  await recordSample(ok)
}

async function recordSample(ok: boolean): Promise<void> {
  if (ok) {
    state.failures = 0
    if (state.down) {
      state.down = false
      await alert('Site is back up', 'woodchuckertrees.com is answering again.')
    }
    return
  }
  state.failures++
  if (!state.down && state.failures >= FAILS_TO_ALERT) {
    state.down = true
    await alert('Site is DOWN', `woodchuckertrees.com failed ${FAILS_TO_ALERT} checks in a row.`)
  }
}

// reportExternalStatus: an uptime checker's verdict enters the same state
// machine. Their monitoring already debounced, so 'down' alerts immediately.
export async function reportExternalStatus(status: 'up' | 'down', source: string): Promise<void> {
  if (status === 'down') {
    if (!state.down) {
      state.down = true
      state.failures = FAILS_TO_ALERT
      await alert('Site is DOWN', `Reported by ${source}.`)
    }
    return
  }
  state.failures = 0
  if (state.down) {
    state.down = false
    await alert('Site is back up', `Reported by ${source}.`)
  }
}

async function alert(title: string, body: string): Promise<void> {
  try {
    await broadcastPush({ title, body, url: '/' })
  } catch (err) {
    console.error('health: alert push failed:', err)
  }
}
