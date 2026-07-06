'use server'
// Public booking action — NO auth (anyone can book). Everything is validated
// hard: the slot must still be open (re-checked to avoid two people grabbing
// one half-day), and a name plus a way to reach them is required. A hidden
// honeypot field catches the dumb bots.
import { redirect } from 'next/navigation'
import { createLead } from '../../lib/leads'
import { createJob } from '../../lib/jobs'
import { slotIsBookable, slotLabel } from '../../lib/booking'
import { sendMail, bookingConfirmationEmail } from '../../lib/mail'

export async function createBookingAction(formData: FormData): Promise<void> {
  // Honeypot: a real person never fills a hidden "company" field. Pretend it
  // worked so the bot moves on, but create nothing.
  if (String(formData.get('company') ?? '').trim()) redirect('/book/confirmed')

  const startsAt = Number(formData.get('slot'))
  const name = String(formData.get('name') ?? '').trim().slice(0, 120)
  const phone = String(formData.get('phone') ?? '').trim().slice(0, 40)
  const email = String(formData.get('email') ?? '').trim().slice(0, 160)
  const summary = String(formData.get('summary') ?? '').trim().slice(0, 500)

  if (!slotIsBookable(startsAt)) redirect('/book?taken=1')
  if (!name || (!phone && !email)) redirect('/book?missing=1')

  const leadId = createLead({ source: 'booking', name, phone, email, summary })
  createJob({ lead_id: leadId, title: summary || `Booking — ${name}`, starts_at: startsAt })

  if (email) {
    try {
      const { subject, html } = bookingConfirmationEmail(name, slotLabel(startsAt))
      await sendMail(email, subject, html)
    } catch (err) {
      console.error('booking confirmation email failed:', err)
    }
  }

  redirect('/book/confirmed')
}
