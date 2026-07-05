// The pipeline board. One screen that shows the whole business at a glance —
// money summary up top, the next appointments, then every stage laid out in
// full so the structure reads even with zero leads. Nothing is hidden behind a
// filter. Server component; every render is live data.
import Link from 'next/link'
import { requireUser } from '../lib/session'
import { leadsByStage, stageTotals, nextStage, STAGES, type Stage } from '../lib/leads'
import { upcomingJobCount, jobsInRange } from '../lib/jobs'
import { money, timeAgo, dateTimeShort } from '../lib/format'
import { vapidPublicKey } from '../lib/env'
import { logoutAction, moveStageAction } from './actions'
import { PushToggle } from './push-toggle'

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

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="wordmark">
          Woodchuckers <em>CRM</em>
        </Link>
        <nav className="topnav">
          <Link href="/jobs">Schedule</Link>
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

      <nav className="rail" aria-label="Jump to stage">
        {STAGES.map((s) => (
          <a key={s} href={`#stage-${s}`} className="chip">
            {s} <span className="n">{totals.get(s)!.n}</span>
          </a>
        ))}
      </nav>

      <div className="board">
        {STAGES.map((s) => {
          const t = totals.get(s)!
          const leads = leadsFor.get(s)!
          return (
            <section key={s} id={`stage-${s}`} className="stage-group" data-stage={s}>
              <header className="stage-head">
                <h2 className="stage-name">{s}</h2>
                <span className="stage-n">{t.n}</span>
                <span className={`stage-cents${s === 'paid' ? ' paid' : ''}`}>{money(t.cents)}</span>
              </header>

              {leads.length === 0 ? (
                <p className="ghost">
                  No leads in <span className="cap">{s}</span>
                </p>
              ) : (
                <div className="cards">
                  {leads.map((lead) => {
                    const next = nextStage(lead.stage)
                    return (
                      <article key={lead.id} className="card" data-stage={lead.stage}>
                        <Link href={`/leads/${lead.id}`}>
                          <div className="row1">
                            <span className="who">
                              {lead.name || lead.email || lead.phone || 'Unknown'}
                            </span>
                            <span className={`value${lead.stage === 'paid' ? ' paid' : ''}`}>
                              {money(lead.value_cents)}
                            </span>
                          </div>
                          {lead.summary ? <p className="summary">{lead.summary}</p> : null}
                          <div className="meta">
                            <span>{lead.source}</span>
                            <span>{timeAgo(lead.updated_at)}</span>
                          </div>
                        </Link>
                        {next ? (
                          <div className="actions">
                            <form action={moveStageAction} style={{ display: 'contents' }}>
                              <input type="hidden" name="lead_id" value={lead.id} />
                              <input type="hidden" name="to" value={next} />
                              <button className="btn btn-advance" type="submit">
                                Mark {next}
                              </button>
                            </form>
                            <form action={moveStageAction} style={{ display: 'contents' }}>
                              <input type="hidden" name="lead_id" value={lead.id} />
                              <input type="hidden" name="to" value="lost" />
                              <button className="btn btn-quiet" type="submit">
                                Lost
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
