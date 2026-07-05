// The schedule: a month calendar over the jobs table plus a day agenda and a
// new-appointment form fed by live pipeline leads. Server component, no
// client JS — every cell is a link, every mutation a form.
import Link from 'next/link'
import { requireUser } from '../../lib/session'
import { jobsInRange, type Job } from '../../lib/jobs'
import { activeLeads, leadAddress, leadByID } from '../../lib/leads'
import { money } from '../../lib/format'
import { logoutAction } from '../actions'
import { createJobAction, rescheduleJobAction, setJobStatusAction } from './actions'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ m?: string; d?: string; lead?: string }> }

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function timeShort(epoch: number): string {
  return new Date(epoch * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function durationDays(j: Job): number {
  return j.ends_at ? Math.max(1, Math.round((j.ends_at - j.starts_at) / 86400)) : 1
}

export default async function JobsPage({ searchParams }: Props) {
  await requireUser()
  const sp = await searchParams

  const today = new Date()
  const todayKey = dayKey(today)

  // Month in view: ?m=YYYY-MM, else the selected day's month, else now.
  const mMatch = /^(\d{4})-(\d{2})$/.exec(sp.m ?? sp.d?.slice(0, 7) ?? '')
  const year = mMatch ? Number(mMatch[1]) : today.getFullYear()
  const month = mMatch ? Number(mMatch[2]) - 1 : today.getMonth()

  const monthStart = new Date(year, month, 1)
  const nextMonthStart = new Date(year, month + 1, 1)
  const monthKey = `${year}-${pad(month + 1)}`
  const prevKey = `${monthStart.getFullYear() - (month === 0 ? 1 : 0)}-${pad(month === 0 ? 12 : month)}`
  const nextKey = `${nextMonthStart.getFullYear()}-${pad(nextMonthStart.getMonth() + 1)}`
  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const selected = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : null

  const jobs = jobsInRange(
    Math.floor(monthStart.getTime() / 1000),
    Math.floor(nextMonthStart.getTime() / 1000),
  )
  const byDay = new Map<string, Job[]>()
  for (const j of jobs) {
    const k = dayKey(new Date(j.starts_at * 1000))
    byDay.set(k, [...(byDay.get(k) ?? []), j])
  }

  // Grid: leading blanks to the first weekday, then one cell per day.
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = Array(monthStart.getDay()).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${monthKey}-${pad(d)}`)

  const agenda = selected ? (byDay.get(selected) ?? []) : jobs
  const leads = activeLeads()

  // Prefill the form when arriving from a lead's "Schedule" button.
  const prefillID = Number(sp.lead)
  const prefillLead = Number.isInteger(prefillID) && prefillID > 0 ? leadByID(prefillID) : null
  const prefillAddress = prefillLead ? leadAddress(prefillLead.id) : ''

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="wordmark">
          Woodchuckers <em>CRM</em>
        </Link>
        <nav className="topnav">
          <Link href="/">Pipeline</Link>
          <form action={logoutAction}>
            <button type="submit">Sign out</button>
          </form>
        </nav>
      </header>

      <div className="cal-head">
        <Link className="btn btn-quiet" href={`/jobs?m=${prevKey}`} aria-label="Previous month">
          ‹
        </Link>
        <h1>{monthLabel}</h1>
        <Link className="btn btn-quiet" href={`/jobs?m=${nextKey}`} aria-label="Next month">
          ›
        </Link>
      </div>

      <div className="cal-grid" role="grid" aria-label={`Calendar, ${monthLabel}`}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
          <span key={`${w}${i}`} className="cal-wd">
            {w}
          </span>
        ))}
        {cells.map((k, i) =>
          k === null ? (
            <span key={`pad${i}`} className="cal-day pad" />
          ) : (
            <Link
              key={k}
              href={`/jobs?m=${monthKey}&d=${k}`}
              className={`cal-day${k === todayKey ? ' today' : ''}${k === selected ? ' selected' : ''}`}
            >
              <span className="dnum">{Number(k.slice(8))}</span>
              {byDay.has(k) ? <span className="dcount">{byDay.get(k)!.length}</span> : null}
            </Link>
          ),
        )}
      </div>

      <section>
        <h2>
          {selected
            ? new Date(`${selected}T12:00:00`).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })
            : `All of ${monthLabel}`}
          {selected ? (
            <Link className="cal-clear" href={`/jobs?m=${monthKey}`}>
              show month
            </Link>
          ) : null}
        </h2>

        {agenda.length === 0 ? (
          <p className="empty">Nothing scheduled. Book something below — the trees aren’t going anywhere.</p>
        ) : (
          <div className="cards">
            {agenda.map((j) => (
              <article key={j.id} className="card job" data-status={j.status}>
                <div className="row1">
                  <span className="who">
                    {timeShort(j.starts_at)} · {j.title}
                  </span>
                  <span className="value">{money(j.day_rate_cents)}{j.day_rate_cents ? '/day' : ''}</span>
                </div>
                <div className="meta">
                  {!selected ? (
                    <span>
                      {new Date(j.starts_at * 1000).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  ) : null}
                  <span>
                    {durationDays(j)} {durationDays(j) === 1 ? 'day' : 'days'}
                  </span>
                  {j.address ? (
                    <a href={`https://maps.apple.com/?q=${encodeURIComponent(j.address)}`}>
                      {j.address}
                    </a>
                  ) : null}
                  {j.lead_id ? <Link href={`/leads/${j.lead_id}`}>lead ↗</Link> : null}
                  <span className={`jstatus ${j.status}`}>{j.status}</span>
                </div>
                <div className="actions">
                  {j.status === 'scheduled' ? (
                    <>
                      <form action={setJobStatusAction} style={{ display: 'contents' }}>
                        <input type="hidden" name="job_id" value={j.id} />
                        <input type="hidden" name="status" value="done" />
                        <button className="btn btn-advance" type="submit">
                          Done
                        </button>
                      </form>
                      <form action={setJobStatusAction} style={{ display: 'contents' }}>
                        <input type="hidden" name="job_id" value={j.id} />
                        <input type="hidden" name="status" value="canceled" />
                        <button className="btn btn-quiet" type="submit">
                          Cancel
                        </button>
                      </form>
                    </>
                  ) : (
                    <form action={setJobStatusAction} style={{ display: 'contents' }}>
                      <input type="hidden" name="job_id" value={j.id} />
                      <input type="hidden" name="status" value="scheduled" />
                      <button className="btn btn-quiet" type="submit">
                        Reopen
                      </button>
                    </form>
                  )}
                </div>
                {j.status === 'scheduled' ? (
                  <details className="resched">
                    <summary>Reschedule</summary>
                    <form action={rescheduleJobAction} className="job-form">
                      <input type="hidden" name="job_id" value={j.id} />
                      <label>
                        Date
                        <input type="date" name="date" defaultValue={dayKey(new Date(j.starts_at * 1000))} required />
                      </label>
                      <label>
                        Start
                        <input type="time" name="time" defaultValue={`${pad(new Date(j.starts_at * 1000).getHours())}:${pad(new Date(j.starts_at * 1000).getMinutes())}`} required />
                      </label>
                      <button className="btn" type="submit">
                        Move
                      </button>
                    </form>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <details className="new-job" open={!!prefillLead}>
          <summary className="btn btn-advance">+ New appointment</summary>
          <form action={createJobAction} className="job-form">
            <label>
              Lead
              <select name="lead_id" defaultValue={prefillLead ? String(prefillLead.id) : ''}>
                <option value="">— none (manual) —</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    #{l.id} {l.name || l.email || l.phone || 'unknown'} · {l.stage}
                    {l.summary ? ` · ${l.summary.slice(0, 40)}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input
                type="text"
                name="title"
                required
                maxLength={200}
                defaultValue={
                  prefillLead ? prefillLead.summary || `Job for ${prefillLead.name || 'lead #' + prefillLead.id}` : ''
                }
                placeholder="Remove 2 oaks — Martinez"
              />
            </label>
            <label>
              Address
              <input
                type="text"
                name="address"
                maxLength={300}
                defaultValue={prefillAddress}
                placeholder="Service address"
              />
            </label>
            <label>
              Date
              <input type="date" name="date" defaultValue={selected ?? todayKey} required />
            </label>
            <label>
              Start
              <input type="time" name="time" defaultValue="08:00" required />
            </label>
            <label>
              Days
              <input type="number" name="days" min={1} max={30} defaultValue={1} />
            </label>
            <label>
              Day rate ($)
              <input type="number" name="day_rate" min={0} step={25} placeholder="—" />
            </label>
            <button className="btn btn-advance" type="submit">
              Schedule it
            </button>
          </form>
        </details>
      </section>
    </div>
  )
}
