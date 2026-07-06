'use server'
// Server actions for the pipeline. Every mutation re-checks the session —
// actions are public HTTP endpoints, the UI hiding a button secures nothing.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser, endSession } from '../lib/session'
import {
  addLeadNote,
  isStage,
  moveLeadStage,
  leadByID,
  createLead,
  setLeadValue,
  markReviewRequested,
  reviewRequestedAt,
} from '../lib/leads'
import { createTask, completeTask, taskByID } from '../lib/tasks'
import { createQuote } from '../lib/quotes'
import { sendMail, reviewRequestEmail, quoteEmail } from '../lib/mail'
import { appBaseURL } from '../lib/env'
import { parseLocalDateTime } from '../lib/format'

// sendReviewRequest emails a finished customer a review ask, exactly once, and
// only when we can reach them. Best-effort: it never throws into the caller, so
// a mail hiccup can't break a stage move. Marks the lead only on a real send,
// so a failure stays retryable from the manual button. Returns what happened.
async function sendReviewRequest(leadID: number): Promise<'sent' | 'skipped' | 'failed'> {
  const lead = leadByID(leadID)
  if (!lead || !lead.email) return 'skipped'
  if (reviewRequestedAt(leadID) != null) return 'skipped' // already asked
  try {
    const { subject, html } = reviewRequestEmail(lead.name)
    const id = await sendMail(lead.email, subject, html)
    if (id === null) return 'skipped' // mail not configured
    markReviewRequested(leadID)
    addLeadNote(leadID, '✉️ review request sent')
    return 'sent'
  } catch (err) {
    console.error(`review request for lead ${leadID} failed:`, err)
    return 'failed'
  }
}

// dollarsToCents parses a human-typed money field ("1,200", "$1200", "950.50")
// into integer cents, or null for blank/garbage. Money is stored as whole
// cents everywhere; this is the only place strings become that integer.
function dollarsToCents(raw: string): number | null {
  const s = raw.trim().replace(/[$,\s]/g, '')
  if (s === '') return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

export async function moveStageAction(formData: FormData): Promise<void> {
  await requireUser()
  const id = Number(formData.get('lead_id'))
  const to = String(formData.get('to') ?? '')
  if (!Number.isInteger(id) || !isStage(to)) return
  moveLeadStage(id, to)
  // A won job is the moment to ask for a review — fire the ask on the way to
  // 'paid'. Best-effort; never blocks the move from committing.
  if (to === 'paid') await sendReviewRequest(id)
  revalidatePath('/')
  revalidatePath(`/leads/${id}`)
}

// sendQuoteAction emails a customer a dollar figure they can accept or decline
// from a public link. Sending also sets the lead's deal value to the quote and
// moves an early lead to 'quoted' — so the pipeline mirrors what the customer
// is looking at. Best-effort mail: a send hiccup still records the quote.
export async function sendQuoteAction(formData: FormData): Promise<void> {
  await requireUser()
  const id = Number(formData.get('lead_id'))
  const amount_cents = dollarsToCents(String(formData.get('amount') ?? ''))
  const description = String(formData.get('description') ?? '').trim().slice(0, 1000)
  const lead = leadByID(id)
  if (!lead || amount_cents == null || amount_cents <= 0) return

  const quote = createQuote(id, amount_cents, description)
  setLeadValue(id, amount_cents)
  if (lead.stage === 'new' || lead.stage === 'contacted') {
    moveLeadStage(id, 'quoted', `quote sent: $${Math.round(amount_cents / 100)}`)
  }
  addLeadNote(id, `💵 quote sent: $${Math.round(amount_cents / 100).toLocaleString('en-US')}`)

  if (lead.email) {
    try {
      const { subject, html } = quoteEmail(
        lead.name,
        amount_cents,
        description,
        `${appBaseURL()}/quote/${quote.token}`,
      )
      await sendMail(lead.email, subject, html)
    } catch (err) {
      console.error(`quote email for lead ${id} failed:`, err)
    }
  }
  revalidatePath(`/leads/${id}`)
  revalidatePath('/')
}

// requestReviewAction — the manual "Ask for a review" button on the lead page,
// for when you close on the phone or want to retry a failed send.
export async function requestReviewAction(formData: FormData): Promise<void> {
  await requireUser()
  const id = Number(formData.get('lead_id'))
  if (!Number.isInteger(id)) return
  await sendReviewRequest(id)
  revalidatePath(`/leads/${id}`)
}

export async function addNoteAction(formData: FormData): Promise<void> {
  await requireUser()
  const id = Number(formData.get('lead_id'))
  const body = String(formData.get('body') ?? '').trim()
  if (!Number.isInteger(id) || !body || body.length > 4000) return
  addLeadNote(id, body)
  revalidatePath(`/leads/${id}`)
}

export async function createTaskAction(formData: FormData): Promise<void> {
  await requireUser()
  const leadID = Number(formData.get('lead_id'))
  const title = String(formData.get('title') ?? '')
    .trim()
    .slice(0, 200)
  const date = String(formData.get('date') ?? '')
  const time = String(formData.get('time') ?? '09:00')
  if (!Number.isInteger(leadID) || !title || !leadByID(leadID)) return
  const dueAt = parseLocalDateTime(date, time)
  if (!dueAt) return
  createTask(leadID, title, dueAt)
  revalidatePath(`/leads/${leadID}`)
}

export async function completeTaskAction(formData: FormData): Promise<void> {
  await requireUser()
  const id = Number(formData.get('task_id'))
  if (!Number.isInteger(id)) return
  const task = taskByID(id)
  if (!task) return
  completeTask(id)
  if (task.lead_id) revalidatePath(`/leads/${task.lead_id}`)
}

// createLeadAction adds a lead by hand — the phone call, the walk-up, the
// referral that never touches the website form. Source is 'manual' so the
// pipeline can tell hand-entered work from webhook leads. Redirects straight
// to the new lead so the next move (quote, schedule) is one tap away.
export async function createLeadAction(formData: FormData): Promise<void> {
  await requireUser()
  const name = String(formData.get('name') ?? '').trim().slice(0, 120)
  const phone = String(formData.get('phone') ?? '').trim().slice(0, 40)
  const email = String(formData.get('email') ?? '').trim().slice(0, 160)
  const summary = String(formData.get('summary') ?? '').trim().slice(0, 500)
  const value_cents = dollarsToCents(String(formData.get('value') ?? ''))
  // Need at least one way to identify or reach them; an all-blank lead is noise.
  if (!name && !phone && !email) {
    revalidatePath('/')
    redirect('/')
  }
  const id = createLead({ source: 'manual', name, phone, email, summary, value_cents })
  revalidatePath('/')
  redirect(`/leads/${id}`)
}

// setLeadValueAction sets the dollar value of a deal — what makes the pipeline
// and Won totals real money instead of a lead count. Blank clears it.
export async function setLeadValueAction(formData: FormData): Promise<void> {
  await requireUser()
  const id = Number(formData.get('lead_id'))
  if (!Number.isInteger(id) || !leadByID(id)) return
  setLeadValue(id, dollarsToCents(String(formData.get('value') ?? '')))
  revalidatePath(`/leads/${id}`)
  revalidatePath('/')
}

export async function logoutAction(): Promise<void> {
  await endSession()
  redirect('/login')
}
