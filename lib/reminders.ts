// reminders.ts — the in-process due-task check (roadmap #3). Single Fly
// machine ⇒ a plain interval is correct, same reasoning as the rate limiter.
// Started once from instrumentation.ts; the globalThis guard survives dev HMR.
import { nowEpoch } from './db'
import { broadcastPush, pushConfigured } from './push'
import { dueUnnotified, markNotified } from './tasks'
import { jobsNeedingReminder, markJobReminded } from './jobs'
import { coldLeads, markLeadNudged } from './leads'
import { sendMail, jobReminderEmail, mailerConfigured } from './mail'
import { slotLabel } from './booking'

// How far ahead a booked customer gets their reminder email (~the day before).
const JOB_REMINDER_LEAD_S = 30 * 60 * 60
// How long a working lead can sit untouched before you get nudged to follow up.
const COLD_LEAD_AFTER_S = 3 * 24 * 60 * 60

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

// runJobReminders emails booked customers the day before their appointment,
// once each. Marks fired even when mail is off or absent so nobody is nagged
// every minute — same fire-once rule as the task reminders.
export async function runJobReminders(): Promise<number> {
  const now = nowEpoch()
  let sent = 0
  for (const job of jobsNeedingReminder(now, now + JOB_REMINDER_LEAD_S)) {
    if (mailerConfigured() && job.lead_email) {
      try {
        const { subject, html } = jobReminderEmail(job.lead_name ?? '', slotLabel(job.starts_at))
        await sendMail(job.lead_email, subject, html)
      } catch (err) {
        console.error(`job reminder ${job.id} failed:`, err)
      }
    }
    markJobReminded(job.id)
    sent++
  }
  return sent
}

// runColdLeadNudges pushes the operator about working leads that have gone
// quiet, once per cold spell. It's a nudge to YOU (not the customer), so it
// only fires when push is configured; still marks so it never double-pings.
export async function runColdLeadNudges(): Promise<number> {
  const staleBefore = nowEpoch() - COLD_LEAD_AFTER_S
  let nudged = 0
  for (const lead of coldLeads(staleBefore)) {
    if (pushConfigured()) {
      await broadcastPush({
        title: `Lead going cold: ${lead.name || '#' + lead.id}`,
        body: `No movement in ${lead.stage} for 3 days — time to follow up.`,
        url: `/leads/${lead.id}`,
      })
    }
    markLeadNudged(lead.id)
    nudged++
  }
  return nudged
}

async function tick(): Promise<void> {
  if (g.__crmReminderBusy) return // a slow push fan-out must not stack ticks
  g.__crmReminderBusy = true
  try {
    await runDueReminders()
    await runJobReminders()
    await runColdLeadNudges()
  } catch (err) {
    console.error('reminders: tick failed:', err)
  } finally {
    g.__crmReminderBusy = false
  }
}
