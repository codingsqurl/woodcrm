// Public booking page — a customer picks an open half-day and leaves their
// details. No auth. Works without JavaScript: it's one form, the slot is a
// radio, the submit is a server action. Selecting a slot lands it as a lead +
// scheduled job in the pipeline and emails the customer a confirmation.
import type { Metadata } from 'next'
import { availableSlots } from '../../lib/booking'
import { createBookingAction } from './actions'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Book Woodchuckers',
  description: 'Pick a time for your tree work with Woodchuckers, Colorado Springs.',
}

type Props = { searchParams: Promise<{ taken?: string; missing?: string }> }

export default async function BookPage({ searchParams }: Props) {
  const sp = await searchParams
  const slots = availableSlots()

  // Group slots by day for a calendar-ish layout.
  const byDay = new Map<string, typeof slots>()
  for (const s of slots) {
    const arr = byDay.get(s.dayLabel) ?? []
    arr.push(s)
    byDay.set(s.dayLabel, arr)
  }

  return (
    <div className="book">
      <header className="book-head">
        <p className="book-brand">Woodchuckers</p>
        <h1>Book your tree work</h1>
        <p className="book-sub">
          Pick an open morning or afternoon. I'll confirm the details and give you a firm day rate.
        </p>
      </header>

      {sp.taken ? (
        <p className="book-alert">That slot just filled. Pick another below.</p>
      ) : null}
      {sp.missing ? (
        <p className="book-alert">Add your name and a phone or email so I can reach you.</p>
      ) : null}

      {slots.length === 0 ? (
        <p className="book-empty">
          Fully booked for the next two weeks. Call <a href="tel:+17197562597">(719) 756-2597</a> and
          we'll find a time.
        </p>
      ) : (
        <form className="book-form" action={createBookingAction}>
          <fieldset className="book-slots">
            <legend>Choose a time</legend>
            <div className="book-days">
              {[...byDay.entries()].map(([day, daySlots]) => (
                <div key={day} className="book-day">
                  <span className="book-day-label">{day}</span>
                  <div className="book-periods">
                    {daySlots.map((s) => (
                      <label key={s.startsAt} className="book-slot">
                        <input type="radio" name="slot" value={s.startsAt} required />
                        <span>{s.period}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="book-fields">
            <label>
              Your name
              <input type="text" name="name" required maxLength={120} placeholder="Rosa Martinez" />
            </label>
            <label>
              Phone
              <input type="tel" name="phone" maxLength={40} placeholder="(719) 555-0142" />
            </label>
            <label>
              Email
              <input type="email" name="email" maxLength={160} placeholder="you@email.com" />
            </label>
            <label className="book-wide">
              What do you need done?
              <textarea
                name="summary"
                maxLength={500}
                rows={3}
                placeholder="Two big oaks over the driveway need to come down…"
              />
            </label>
            {/* honeypot — hidden from people, catches bots */}
            <input
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="book-hp"
            />
          </div>

          <button className="book-submit" type="submit">
            Book it
          </button>
          <p className="book-fine">Phone or email required so we can confirm.</p>
        </form>
      )}
    </div>
  )
}
