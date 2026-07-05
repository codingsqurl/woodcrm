// reminders.ts — the in-process due-task check (roadmap #3). Single Fly
// machine ⇒ a plain interval is correct, same reasoning as the rate limiter.
// Started once from instrumentation.ts; the globalThis guard survives dev HMR.
import { nowEpoch } from './db'
import { broadcastPush, pushConfigured } from './push'
import { dueUnnotified, markNotified } from './tasks'

const TICK_MS = 60_000

const g = globalThis as unknown as { __crmReminderTimer?: NodeJS.Timeout; __crmReminderBusy?: boolean }

export function startReminderLoop(): void {
  if (g.__crmReminderTimer) return
  g.__crmReminderTimer = setInterval(tick, TICK_MS)
  g.__crmReminderTimer.unref?.()
}

// runDueReminders pushes every task that's due and un-notified, then marks it.
// Exported so it's a testable unit (the interface is the test surface): the
// interval calls it, and scripts/reminders-e2e.ts drives it directly. Returns
// how many tasks were notified.
export async function runDueReminders(): Promise<number> {
  let notified = 0
  for (const task of dueUnnotified(nowEpoch())) {
    // Fire once: mark even when nobody is subscribed or delivery fails —
    // a reminder that nags every minute is worse than one missed push.
    if (pushConfigured()) {
      await broadcastPush({
        title: `Follow up: ${task.title}`,
        body: task.lead_name ?? '',
        url: task.lead_id ? `/leads/${task.lead_id}` : '/',
      })
    }
    markNotified(task.id)
    notified++
  }
  return notified
}

async function tick(): Promise<void> {
  if (g.__crmReminderBusy) return // a slow push fan-out must not stack ticks
  g.__crmReminderBusy = true
  try {
    await runDueReminders()
  } catch (err) {
    console.error('reminders: tick failed:', err)
  } finally {
    g.__crmReminderBusy = false
  }
}
