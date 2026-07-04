// Lead detail: everything known about one lead, with tap-to-call/text/email
// (this gets used from a truck), full stage control, notes, and the immutable
// pipeline history.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '../../../lib/session'
import { leadByID, leadEvents, leadNotes, STAGES } from '../../../lib/leads'
import { dateTimeShort, money } from '../../../lib/format'
import { addNoteAction, moveStageAction } from '../../actions'

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
        <h2>Notes</h2>
        <form className="note-form" action={addNoteAction}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <textarea name="body" placeholder="Add a note" required maxLength={4000} />
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
