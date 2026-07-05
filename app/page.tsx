// The pipeline inbox. One screen, one job: show where the money sits and let
// you advance it with a thumb. Server component; every render is live data —
// a CRM that shows stale leads is lying to you.
import Link from 'next/link'
import { requireUser } from '../lib/session'
import { leadsByStage, stageTotals, nextStage, isStage, STAGES, type Stage } from '../lib/leads'
import { upcomingJobCount } from '../lib/jobs'
import { money, timeAgo } from '../lib/format'
import { logoutAction, moveStageAction } from './actions'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ stage?: string }> }

export default async function PipelinePage({ searchParams }: Props) {
  await requireUser()

  const sp = await searchParams
  const stage: Stage = sp.stage && isStage(sp.stage) ? sp.stage : 'new'
  const leads = leadsByStage(stage)
  const totals = stageTotals()
  const current = totals.get(stage)!

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="wordmark">
          Woodchuckers <em>CRM</em>
        </Link>
        <nav className="topnav">
          <Link href="/jobs">
            Schedule{upcomingJobCount() > 0 ? <span className="n">{upcomingJobCount()}</span> : null}
          </Link>
          <form action={logoutAction}>
            <button type="submit">Sign out</button>
          </form>
        </nav>
      </header>

      <nav className="rail" aria-label="Pipeline stages">
        {STAGES.map((s) => {
          const t = totals.get(s)!
          return (
            <Link
              key={s}
              href={`/?stage=${s}`}
              className={`chip${s === stage ? ' active' : ''}`}
              aria-current={s === stage ? 'page' : undefined}
            >
              {s} <span className="n">{t.n}</span>
            </Link>
          )
        })}
      </nav>

      <div className="stage-sum">
        <span>
          {current.n} {current.n === 1 ? 'lead' : 'leads'} in {stage}
        </span>
        <span className="cents">{money(current.cents)}</span>
      </div>

      {leads.length === 0 ? (
        <p className="empty">
          Nothing in {stage}. New site leads land here on their own — the webhook does the walking.
        </p>
      ) : (
        <div className="cards">
          {leads.map((lead) => {
            const next = nextStage(lead.stage)
            return (
              <article key={lead.id} className="card" data-stage={lead.stage}>
                <Link href={`/leads/${lead.id}`}>
                  <div className="row1">
                    <span className="who">{lead.name || lead.email || lead.phone || 'Unknown'}</span>
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
    </div>
  )
}
