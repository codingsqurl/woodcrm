// The pipeline board. One screen that shows the whole business at a glance —
// money summary up top, the next appointments, then every stage laid out in
// full so the structure reads even with zero leads. Nothing is hidden behind a
// filter. Server component; every render is live data.
import Link from 'next/link'
import { requireUser } from '../lib/session'
import { leadsByStage, stageTotals, nextStage, STAGES, type Stage } from '../lib/leads'
import { upcomingJobCount, jobsInRange } from '../lib/jobs'
import { money, dateTimeShort } from '../lib/format'
import { vapidPublicKey } from '../lib/env'
import { logoutAction, createLeadAction } from './actions'
import { PushToggle } from './push-toggle'
import { PipelineBoard } from './pipeline-board'

export const dynamic = 'force-dynamic'

// Stages that count as live opportunity money (not won, not lost).
const OPEN: Stage[] = ['new', 'contacted', 'quoted', 'scheduled']

function startOfTodayEpoch(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

export default async function PipelinePage() {
  await requireUser()

  const totals = stageTotals()
  const leadsFor = new Map<Stage, ReturnType<typeof leadsByStage>>(
    STAGES.map((s) => [s, leadsByStage(s)]),
  )

  const openCount = OPEN.reduce((a, s) => a + totals.get(s)!.n, 0)
  const pipelineCents = OPEN.reduce((a, s) => a + totals.get(s)!.cents, 0)
  const wonCents = totals.get('paid')!.cents
  const jobsCount = upcomingJobCount()

  const today = startOfTodayEpoch()
  const upcoming = jobsInRange(today, today + 60 * 24 * 60 * 60).slice(0, 3)

  // Serializable board data for the client drag-drop component: each lead
  // carries its own precomputed next stage (nextStage can't cross into the
  // client bundle — it lives beside the DB layer).
  const boardGroups = STAGES.map((s) => {
    const t = totals.get(s)!
    return {
      stage: s,
      n: t.n,
      cents: t.cents,
      leads: leadsFor.get(s)!.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        phone: l.phone,
        summary: l.summary,
        source: l.source,
        stage: l.stage,
        value_cents: l.value_cents,
        updated_at: l.updated_at,
        next: nextStage(l.stage),
      })),
    }
  })

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="wordmark">
          Woodchuckers <em>CRM</em>
        </Link>
        <nav className="topnav">
          <Link href="/jobs">Schedule</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/notes">Brain</Link>
          <PushToggle vapidKey={vapidPublicKey()} />
          <form action={logoutAction}>
            <button type="submit">Sign out</button>
          </form>
        </nav>
      </header>

      <section className="kpis" aria-label="Business at a glance">
        <div className="kpi">
          <span className="kpi-label">Open leads</span>
          <span className="kpi-num">{openCount}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Pipeline</span>
          <span className="kpi-num">{money(pipelineCents)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Won</span>
          <span className="kpi-num paid">{money(wonCents)}</span>
        </div>
        <Link className="kpi kpi-link" href="/jobs">
          <span className="kpi-label">Upcoming jobs</span>
          <span className="kpi-num">{jobsCount}</span>
        </Link>
      </section>

      <section className="coming" aria-label="Next appointments">
        <div className="coming-head">
          <span>Coming up</span>
          <Link href="/jobs">Schedule ›</Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="coming-empty">Nothing booked yet. The calendar’s ready when you are.</p>
        ) : (
          <ul className="coming-list">
            {upcoming.map((j) => (
              <li key={j.id}>
                <span className="coming-when">{dateTimeShort(j.starts_at)}</span>
                <span className="coming-what">{j.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="new-lead-wrap">
        <details className="new-job new-lead">
          <summary className="btn btn-advance">+ New lead</summary>
          <form action={createLeadAction} className="job-form">
            <label>
              Name
              <input type="text" name="name" maxLength={120} placeholder="Martinez" />
            </label>
            <label>
              Phone
              <input type="tel" name="phone" maxLength={40} placeholder="(719) 555-0142" />
            </label>
            <label>
              Email
              <input type="email" name="email" maxLength={160} placeholder="optional" />
            </label>
            <label>
              Value $
              <input type="text" name="value" inputMode="decimal" placeholder="1200" />
            </label>
            <label className="wide">
              Job
              <input
                type="text"
                name="summary"
                maxLength={500}
                placeholder="Remove 2 oaks over the driveway"
              />
            </label>
            <button className="btn" type="submit">
              Add lead
            </button>
          </form>
        </details>
      </section>

      <nav className="rail" aria-label="Jump to stage">
        {STAGES.map((s) => (
          <a key={s} href={`#stage-${s}`} className="chip">
            {s} <span className="n">{totals.get(s)!.n}</span>
          </a>
        ))}
      </nav>

      <PipelineBoard groups={boardGroups} />
    </div>
  )
}
