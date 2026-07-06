// Reports — what's making money. Server component, live aggregates: won revenue
// and win rate up top, a six-month revenue trend, where leads come from, and the
// current pipeline funnel. No chart library — bars are divs, numbers are mono.
import Link from 'next/link'
import { requireUser } from '../../lib/session'
import { reportSummary, wonByMonth, bySource } from '../../lib/reports'
import { stageTotals, STAGES } from '../../lib/leads'
import { money } from '../../lib/format'
import { logoutAction } from '../actions'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  await requireUser()

  const summary = reportSummary()
  const months = wonByMonth(6)
  const sources = bySource()
  const totals = stageTotals()

  const monthMax = Math.max(1, ...months.map((m) => m.cents))
  const funnelMax = Math.max(1, ...STAGES.map((s) => totals.get(s)!.n))
  const winPct = Math.round(summary.winRate * 100)

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

      <h1 className="page-h1">Reports</h1>

      <section className="kpis" aria-label="Headline numbers">
        <div className="kpi">
          <span className="kpi-label">Won (all time)</span>
          <span className="kpi-num paid">{money(summary.wonCents)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Win rate</span>
          <span className="kpi-num">{summary.wonCount + summary.lostCount > 0 ? `${winPct}%` : '—'}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Avg deal</span>
          <span className="kpi-num">{summary.wonCount > 0 ? money(summary.avgCents) : '—'}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Open pipeline</span>
          <span className="kpi-num">{money(summary.openCents)}</span>
        </div>
      </section>

      <section className="report-block">
        <h2>Revenue, last 6 months</h2>
        {summary.wonCount === 0 ? (
          <p className="ghost">No won jobs yet — mark a lead Paid and it shows here.</p>
        ) : (
          <div className="bars" role="img" aria-label="Won revenue by month">
            {months.map((m) => (
              <div key={m.ym} className="bar-col">
                <span className="bar-val">{m.cents > 0 ? money(m.cents) : ''}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ height: `${Math.round((m.cents / monthMax) * 100)}%` }}
                  />
                </div>
                <span className="bar-label">{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="report-block">
        <h2>Where leads come from</h2>
        {sources.length === 0 ? (
          <p className="ghost">No leads yet.</p>
        ) : (
          <table className="report-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Leads</th>
                <th>Won</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.source}>
                  <td>{s.source}</td>
                  <td className="num">{s.leads}</td>
                  <td className="num paid">{s.wonCount > 0 ? money(s.wonCents) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="report-block">
        <h2>Pipeline funnel</h2>
        <div className="funnel">
          {STAGES.map((s) => {
            const t = totals.get(s)!
            return (
              <div key={s} className="funnel-row">
                <span className="funnel-name">{s}</span>
                <div className="funnel-track">
                  <div
                    className={`funnel-fill${s === 'paid' ? ' paid' : ''}${s === 'lost' ? ' lost' : ''}`}
                    style={{ width: `${Math.round((t.n / funnelMax) * 100)}%` }}
                  />
                </div>
                <span className="funnel-n">{t.n}</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
