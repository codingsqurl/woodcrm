// quotes.ts — a dollar figure sent to a customer who accepts or declines it from
// a public link carrying an unguessable token. Sending is a normal action; the
// accept/decline lives behind the token so no login is needed on the customer's
// end. Status only moves out of 'sent' once (first answer wins).
import { randomBytes } from 'node:crypto'
import { db, nowEpoch } from './db'

export type QuoteStatus = 'sent' | 'accepted' | 'declined'

export type Quote = {
  id: number
  lead_id: number
  token: string
  amount_cents: number
  description: string
  status: QuoteStatus
  sent_at: number
  responded_at: number | null
}

const COLS = `id, lead_id, token, amount_cents, description, status, sent_at, responded_at`

const insertStmt = db.prepare(
  `INSERT INTO quotes (lead_id, token, amount_cents, description) VALUES (?, ?, ?, ?)`,
)
const byIDStmt = db.prepare(`SELECT ${COLS} FROM quotes WHERE id = ?`)
const byTokenStmt = db.prepare(`SELECT ${COLS} FROM quotes WHERE token = ?`)
const forLeadStmt = db.prepare(`SELECT ${COLS} FROM quotes WHERE lead_id = ? ORDER BY sent_at DESC`)
const latestStmt = db.prepare(
  `SELECT ${COLS} FROM quotes WHERE lead_id = ? ORDER BY sent_at DESC LIMIT 1`,
)
// First answer wins: only a still-'sent' quote can be accepted/declined.
const respondStmt = db.prepare(
  `UPDATE quotes SET status = ?, responded_at = ? WHERE token = ? AND status = 'sent'`,
)

export function createQuote(leadID: number, amountCents: number, description: string): Quote {
  const token = randomBytes(16).toString('hex')
  const info = insertStmt.run(leadID, token, amountCents, description)
  return byIDStmt.get(info.lastInsertRowid) as Quote
}

export function quoteByToken(token: string): Quote | null {
  return (byTokenStmt.get(token) as Quote | undefined) ?? null
}

export function quotesForLead(leadID: number): Quote[] {
  return forLeadStmt.all(leadID) as Quote[]
}

export function latestQuoteForLead(leadID: number): Quote | null {
  return (latestStmt.get(leadID) as Quote | undefined) ?? null
}

// respondToQuote records the customer's answer, returning true only if THIS call
// was the one that moved it out of 'sent' (so a double-click can't double-fire).
export function respondToQuote(token: string, status: 'accepted' | 'declined'): boolean {
  return respondStmt.run(status, nowEpoch(), token).changes > 0
}
