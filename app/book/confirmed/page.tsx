// Booking success page.
import type { Metadata } from 'next'

export const metadata: Metadata = { title: "You're booked — Woodchuckers" }

export default function BookedPage() {
  return (
    <div className="book">
      <div className="book-done">
        <div className="book-check" aria-hidden="true">
          ✓
        </div>
        <h1>You're on the calendar</h1>
        <p className="book-sub">
          Thanks for booking with Woodchuckers. I'll reach out to confirm the details and give you a
          firm day rate. If you left an email, a confirmation is on its way.
        </p>
        <a className="book-submit" href="tel:+17197562597">
          Call (719) 756-2597
        </a>
      </div>
    </div>
  )
}
