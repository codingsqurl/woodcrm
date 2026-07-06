// reports.ts — the numbers that tell you what's making money: won revenue,
// win rate, average deal, a six-month revenue trend, and per-source
// performance. Raw aggregate queries over the same leads/pipeline_events the
// rest of the app writes; money stays integer cents until the page formats it.
import { db } from './db'

export type ReportSummary = {
  wonCents: number
  wonCount: number
  openCents: number
  lostCount: number
  winRate: number // 0..1, paid / (paid + lost)
  avgCents: number // average won deal
}

const summaryStmt = db.prepare(`
  SELECT
    COALESCE(SUM(CASE WHEN stage = 'paid' THEN value_cents END), 0) AS won_cents,
    COUNT(CASE WHEN stage = 'paid' THEN 1 END) AS won_count,
    COALESCE(SUM(CASE WHEN stage IN ('new','contacted','quoted','scheduled') THEN value_cents END), 0) AS open_cents,
    COUNT(CASE WHEN stage = 'lost' THEN 1 END) AS lost_count
  FROM leads`)

export function reportSummary(): ReportSummary {
  const r = summaryStmt.get() as {
    won_cents: number
    won_count: number
    open_cents: number
    lost_count: number
  }
  const decided = r.won_count + r.lost_count
  return {
    wonCents: r.won_cents,
    wonCount: r.won_count,
    openCents: r.open_cents,
    lostCount: r.lost_count,
    winRate: decided > 0 ? r.won_count / decided : 0,
    avgCents: r.won_count > 0 ? Math.round(r.won_cents / r.won_count) : 0,
  }
}

// wonByMonth — won revenue per calendar month, oldest→newest, over the window.
// Keyed off the pipeline event that moved a lead to 'paid' (when the money was
// won), valued at the lead's current amount.
export type MonthPoint = { ym: string; label: string; cents: number }

const wonByMonthStmt = db.prepare(`
  SELECT strftime('%Y-%m', pe.created_at, 'unixepoch', 'localtime') AS ym,
         COALESCE(SUM(l.value_cents), 0) AS cents
    FROM pipeline_events pe
    JOIN leads l ON l.id = pe.lead_id
   WHERE pe.to_stage = 'paid'
   GROUP BY ym`)

export function wonByMonth(months = 6): MonthPoint[] {
  const rows = wonByMonthStmt.all() as { ym: string; cents: number }[]
  const byYm = new Map(rows.map((r) => [r.ym, r.cents]))
  const out: MonthPoint[] = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({
      ym,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      cents: byYm.get(ym) ?? 0,
    })
  }
  return out
}

// bySource — where leads come from and what each source has won.
export type SourceRow = { source: string; leads: number; wonCents: number; wonCount: number }

const bySourceStmt = db.prepare(`
  SELECT source,
         COUNT(*) AS leads,
         COALESCE(SUM(CASE WHEN stage = 'paid' THEN value_cents END), 0) AS won_cents,
         COUNT(CASE WHEN stage = 'paid' THEN 1 END) AS won_count
    FROM leads
   GROUP BY source
   ORDER BY won_cents DESC, leads DESC`)

export function bySource(): SourceRow[] {
  return (bySourceStmt.all() as { source: string; leads: number; won_cents: number; won_count: number }[]).map(
    (r) => ({ source: r.source, leads: r.leads, wonCents: r.won_cents, wonCount: r.won_count }),
  )
}
