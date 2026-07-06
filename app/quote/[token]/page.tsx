// Public quote page — the customer reviews their number and accepts or declines.
// No auth; the token in the URL is the key. Reuses the /book public styling.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { quoteByToken } from '../../../lib/quotes'
import { respondQuoteAction } from './actions'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Your quote — Woodchuckers' }

type Props = { params: Promise<{ token: string }> }

export default async function QuotePage({ params }: Props) {
  const { token } = await params
  const quote = quoteByToken(token)
  if (!quote) notFound()

  const amount = `$${Math.round(quote.amount_cents / 100).toLocaleString('en-US')}`

  return (
    <div className="book">
      <header className="book-head">
        <p className="book-brand">Woodchuckers</p>
        <h1>Your quote</h1>
      </header>

      {quote.description ? <p className="quote-desc">{quote.description}</p> : null}

      <div className="quote-amount">
        <span className="quote-amount-label">Total</span>
        <span className="quote-amount-num">{amount}</span>
      </div>

      {quote.status === 'sent' ? (
        <div className="quote-actions">
          <form action={respondQuoteAction}>
            <input type="hidden" name="token" value={quote.token} />
            <input type="hidden" name="decision" value="accepted" />
            <button className="book-submit" type="submit">
              Accept this quote
            </button>
          </form>
          <form action={respondQuoteAction}>
            <input type="hidden" name="token" value={quote.token} />
            <input type="hidden" name="decision" value="declined" />
            <button className="quote-decline" type="submit">
              No thanks
            </button>
          </form>
          <p className="book-fine">
            Questions first? Call <a href="tel:+17197562597">(719) 756-2597</a>.
          </p>
        </div>
      ) : quote.status === 'accepted' ? (
        <div className="quote-result">
          <div className="book-check" aria-hidden="true">
            ✓
          </div>
          <h2>Accepted — thank you</h2>
          <p className="book-sub">I'll be in touch shortly to lock in a date. Talk soon.</p>
        </div>
      ) : (
        <div className="quote-result">
          <h2>Quote declined</h2>
          <p className="book-sub">
            Changed your mind, or want a different number? Call{' '}
            <a href="tel:+17197562597">(719) 756-2597</a>.
          </p>
        </div>
      )}
    </div>
  )
}
