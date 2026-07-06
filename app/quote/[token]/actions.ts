'use server'
// Public quote response — NO auth, gated by the unguessable token. Records the
// customer's answer once, notes it on the lead, and pushes the operator so a
// won quote turns into a scheduled job fast.
import { redirect } from 'next/navigation'
import { quoteByToken, respondToQuote } from '../../../lib/quotes'
import { leadByID, addLeadNote } from '../../../lib/leads'
import { broadcastPush } from '../../../lib/push'

export async function respondQuoteAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '')
  const decision = String(formData.get('decision') ?? '')
  const quote = token ? quoteByToken(token) : null
  if (!quote || (decision !== 'accepted' && decision !== 'declined')) {
    redirect(token ? `/quote/${token}` : '/')
  }

  if (respondToQuote(token, decision)) {
    const lead = leadByID(quote.lead_id)
    const who = lead?.name || `lead #${quote.lead_id}`
    addLeadNote(
      quote.lead_id,
      decision === 'accepted' ? '✅ quote accepted by customer' : '❌ quote declined by customer',
    )
    try {
      await broadcastPush({
        title: decision === 'accepted' ? `Quote accepted! ${who}` : `Quote declined — ${who}`,
        body: decision === 'accepted' ? 'Time to schedule the job.' : '',
        url: `/leads/${quote.lead_id}`,
      })
    } catch {
      /* push is best-effort */
    }
  }
  redirect(`/quote/${token}`)
}
