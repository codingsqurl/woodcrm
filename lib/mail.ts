// mail.ts — transactional email through the Resend HTTP API (raw fetch), the
// same door the marketing site uses. When RESEND_API_KEY is unset, email is
// "not configured": callers no-op instead of throwing, so a missing key never
// breaks a pipeline action. Every user value is HTML-escaped.
import { resendApiKey, mailFrom, reviewURL } from './env'

export function mailerConfigured(): boolean {
  return !!resendApiKey()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&#34;')
}

// sendMail posts one HTML email. Returns the Resend message id, or null when
// mail isn't configured (no throw — the caller's action must still succeed).
export async function sendMail(
  to: string,
  subject: string,
  html: string,
  replyTo?: string,
): Promise<string | null> {
  const key = resendApiKey()
  if (!key) return null
  const payload: Record<string, unknown> = { from: mailFrom(), to: [to], subject, html }
  if (replyTo) payload.reply_to = replyTo

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  })
  if (res.status >= 300) {
    throw new Error(`resend ${res.status}: ${await res.text()}`)
  }
  try {
    return ((await res.json()) as { id?: string }).id ?? null
  } catch {
    return null
  }
}

// reviewRequestEmail — sent after a job is marked Paid. Warm, short, one button
// to the review destination (REVIEW_URL — the links page by default, or a
// direct Google review link once set). A happy customer is the cheapest lead.
export function reviewRequestEmail(name: string): { subject: string; html: string } {
  const safe = name ? escapeHtml(name.split(' ')[0]) : 'there'
  const url = reviewURL()
  return {
    subject: 'Thanks from Woodchuckers — one quick favor',
    html: `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#081410;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#081410;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#0e2018;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;">
<tr><td style="background:#06160d;padding:22px 28px;border-bottom:3px solid #f2601c;">
<div style="color:#ffffff;font:800 18px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;">Woodchuckers</div>
</td></tr>
<tr><td style="padding:28px;">
<div style="color:#ffffff;font:800 22px Arial,sans-serif;margin:0 0 14px;">Thanks, ${safe}.</div>
<div style="color:#c8d2c8;font:400 16px/1.6 Arial,sans-serif;margin:0 0 22px;">It was a pleasure getting that work done for you. If we earned it, a quick review helps other folks in the neighborhood find us — it only takes a minute and it means a lot to a one-person shop.</div>
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td><a href="${url}" style="display:inline-block;background:#f2601c;color:#0e1411;font:700 15px Arial,sans-serif;text-decoration:none;padding:13px 26px;border-radius:10px;">Leave a review</a></td>
</tr></table>
</td></tr>
<tr><td style="background:#06160d;padding:16px 28px;border-top:1px solid rgba(255,255,255,.08);">
<div style="color:#7fb89a;font:400 12px Arial,sans-serif;">Woodchuckers · Contract tree climbing · Colorado Springs</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
  }
}
