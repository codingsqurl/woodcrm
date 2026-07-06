// booking.ts — availability for the public /book page. Tree work is day-rate,
// not 30-minute slots, so the calendar offers coarse half-days: Morning (8am)
// and Afternoon (1pm), Monday–Saturday, for the next two weeks. A slot is open
// unless it's in the past or a scheduled job already sits in that half-day.
import { jobsInRange } from './jobs'

export type Slot = {
  startsAt: number // epoch seconds, local shop time
  period: 'Morning' | 'Afternoon'
  dayLabel: string // "Mon, Jul 7"
}

const AM_HOUR = 8
const PM_HOUR = 13
const DAYS_AHEAD = 14
const HALF_DAY_S = 5 * 60 * 60 // a booked job blocks its whole half-day

function periodsForDay(day: Date): Slot[] {
  const out: Slot[] = []
  for (const [hour, period] of [
    [AM_HOUR, 'Morning'],
    [PM_HOUR, 'Afternoon'],
  ] as const) {
    const s = new Date(day)
    s.setHours(hour, 0, 0, 0)
    out.push({
      startsAt: Math.floor(s.getTime() / 1000),
      period,
      dayLabel: s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    })
  }
  return out
}

// availableSlots returns the open half-days over the next two weeks, in order.
export function availableSlots(nowMs: number = Date.now()): Slot[] {
  const nowSec = Math.floor(nowMs / 1000)
  const start = new Date(nowMs)
  start.setHours(0, 0, 0, 0)
  const rangeEnd = Math.floor(start.getTime() / 1000) + (DAYS_AHEAD + 1) * 24 * 60 * 60

  const booked = jobsInRange(Math.floor(start.getTime() / 1000), rangeEnd).filter(
    (j) => j.status === 'scheduled',
  )
  const isTaken = (startsAt: number) =>
    booked.some((j) => j.starts_at >= startsAt && j.starts_at < startsAt + HALF_DAY_S)

  const slots: Slot[] = []
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const day = new Date(start)
    day.setDate(day.getDate() + d)
    if (day.getDay() === 0) continue // closed Sundays
    for (const slot of periodsForDay(day)) {
      if (slot.startsAt > nowSec && !isTaken(slot.startsAt)) slots.push(slot)
    }
  }
  return slots
}

// slotIsBookable re-checks a chosen slot at submit time: it must be a real
// Morning/Afternoon start, in the future, and still open. Guards the race
// between rendering the page and hitting submit (two people, one slot).
export function slotIsBookable(startsAt: number, nowMs: number = Date.now()): boolean {
  if (!Number.isInteger(startsAt)) return false
  return availableSlots(nowMs).some((s) => s.startsAt === startsAt)
}

// slotLabel renders a chosen slot for confirmations/emails: "Mon, Jul 7 · Morning".
export function slotLabel(startsAt: number): string {
  const d = new Date(startsAt * 1000)
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const period = d.getHours() < 12 ? 'Morning' : 'Afternoon'
  return `${day} · ${period}`
}
