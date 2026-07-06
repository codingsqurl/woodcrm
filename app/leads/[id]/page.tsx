// Lead detail: everything known about one lead, with tap-to-call/text/email
// (this gets used from a truck), full stage control, notes, and the immutable
// pipeline history.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '../../../lib/session'
import { leadByID, leadEvents, leadNotes, reviewRequestedAt, STAGES } from '../../../lib/leads'
import { jobsForLead } from '../../../lib/jobs'
import { tasksForLead } from '../../../lib/tasks'
import { dateTimeShort, money } from '../../../lib/format'
import {
  addNoteAction,
  completeTaskAction,
  createTaskAction,
  moveStageAction,
  setLeadValueAction,
  requestReviewAction,
} from '../../actions'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function LeadPage({ params }: Props) {
  await requireUser()

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id)) notFound()

  const lead = leadByID(id)
  if (!lead) notFound()

  const events = leadEvents(id)
  const notes = leadNotes(id)
  const jobs = jobsForLead(id)
  const tasks = tasksForLead(id)
  const reviewedAt = reviewRequestedAt(id)
  const nowSec = Math.floor(Date.now() / 1000)
  const telHref = lead.phone ? `tel:${lead.phone.replace(/[^\d+]/g, '')}` : null
  const smsHref = lead.phone ? `sms:${lead.phone.replace(/[^\d+]/g, '')}` : null

  return (
    <div className="shell detail">
      <Link href="/" className="back">
        ← Pipeline
      </Link>

      <h1>{lead.name || lead.email || lead.phone || `Lead #${lead.id}`}</h1>
      <p className="sub">
        {lead.source} · in {lead.stage} · {money(lead.value_cents)}
      </p>

      <dl className="kv">
        {lead.phone ? (
          <>
            <dt>Phone</dt>
            <dd>
              {telHref ? <a href={telHref}>{lead.phone}</a> : lead.phone}
              {smsHref ? (
                <>
                  {' · '}
                  <a href={smsHref}>text</a>
                </>
              ) : null}
            </dd>
          </>
        ) : null}
        {lead.email ? (
          <>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${lead.email}`}>{lead.email}</a>
            </dd>
          </>
        ) : null}
        {lead.summary ? (
          <>
            <dt>Job</dt>
            <dd>{lead.summary}</dd>
          </>
        ) : null}
        <dt>Came in</dt>
        <dd>{dateTimeShort(lead.created_at)}</dd>
      </dl>

      <section>
        <h2>Deal value</h2>
        <form className="value-edit" action={setLeadValueAction}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <span className="value-dollar">$</span>
          <input
            type="text"
            name="value"
            inputMode="decimal"
            defaultValue={lead.value_cents != null ? String(Math.round(lead.value_cents / 100)) : ''}
            placeholder="0"
            aria-label="Deal value in dollars"
          />
          <button className="btn" type="submit">
            Save
          </button>
        </form>
      </section>

      <section>
        <h2>Stage</h2>
        <div className="stage-grid">
          {STAGES.map((s) => (
            <form key={s} action={moveStageAction} style={{ display: 'contents' }}>
              <input type="hidden" name="lead_id" value={lead.id} />
              <input type="hidden" name="to" value={s} />
              <button
                className={`btn${s === lead.stage ? ' current' : ''}`}
                type="submit"
                disabled={s === lead.stage}
              >
                {s}
              </button>
            </form>
          ))}
        </div>
      </section>

      <section>
        <h2>Reviews</h2>
        {reviewedAt ? (
          <p className="review-done">
            ✓ Review requested {dateTimeShort(reviewedAt)}
          </p>
        ) : lead.email ? (
          <form action={requestReviewAction}>
            <input type="hidden" name="lead_id" value={lead.id} />
            <button className="btn btn-advance" type="submit">
              Ask for a review
            </button>
            <p className="review-hint">
              Emails {lead.email} a thank-you with a link to leave a review. Sends on its own when
              you mark this Paid.
            </p>
          </form>
        ) : (
          <p className="review-hint">Add an email above to ask this customer for a review.</p>
        )}
      </section>

      <section>
        <h2>Appointments</h2>
        <Link className="btn btn-advance schedule-cta" href={`/jobs?lead=${lead.id}`}>
          Schedule a job
        </Link>
        {jobs.length > 0 ? (
          <ul className="log">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs?d=${new Date(j.starts_at * 1000).toLocaleDateString('en-CA')}`}>
                  {j.title}
                </Link>{' '}
                — {j.status}
                <div className="when">{dateTimeShort(j.starts_at)}</div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2>Follow-ups</h2>
        <form className="task-form" action={createTaskAction}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <input name="title" placeholder="Call back about the quote…" required maxLength={200} />
          <div className="task-when">
            <input type="date" name="date" required />
            <input type="time" name="time" defaultValue="09:00" required />
            <button className="btn" type="submit">
              Add
            </button>
          </div>
        </form>
        {tasks.length === 0 ? (
          <p className="empty">No follow-ups. A due one pings every subscribed phone.</p>
        ) : (
          <ul className="log">
            {tasks.map((t) => (
              <li key={t.id} className={t.done_at ? 'task-done' : undefined}>
                {t.title}
                {!t.done_at ? (
                  <form action={completeTaskAction} style={{ display: 'inline' }}>
                    <input type="hidden" name="task_id" value={t.id} />
                    <button className="chip task-check" type="submit">
                      Done
                    </button>
                  </form>
                ) : null}
                <div className={`when${!t.done_at && t.due_at <= nowSec ? ' overdue' : ''}`}>
                  {t.done_at ? `done ${dateTimeShort(t.done_at)}` : `due ${dateTimeShort(t.due_at)}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Notes</h2>
        <div className="quicklog">
          {(
            [
              ['📞 called', 'Log call'],
              ['💬 texted', 'Log text'],
              ['✉️ emailed', 'Log email'],
            ] as const
          ).map(([body, label]) => (
            <form key={label} action={addNoteAction} style={{ display: 'contents' }}>
              <input type="hidden" name="lead_id" value={lead.id} />
              <input type="hidden" name="body" value={body} />
              <button className="chip" type="submit">
                {label}
              </button>
            </form>
          ))}
        </div>
        <form className="note-form" action={addNoteAction}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <textarea
            name="body"
            placeholder="Add a note — what they said on the phone, what you quoted…"
            required
            maxLength={4000}
          />
          <button className="btn" type="submit">
            Save
          </button>
        </form>
        {notes.length === 0 ? (
          <p className="empty">No notes yet.</p>
        ) : (
          <ul className="log">
            {notes.map((n) => (
              <li key={n.id}>
                {n.body}
                <div className="when">{dateTimeShort(n.created_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>History</h2>
        <ul className="log">
          {events.map((e) => (
            <li key={e.id}>
              {e.from_stage ? `${e.from_stage} → ${e.to_stage}` : `created in ${e.to_stage}`}
              {e.note ? ` — ${e.note}` : ''}
              <div className="when">{dateTimeShort(e.created_at)}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
