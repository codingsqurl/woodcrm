// env.ts — config helpers. Next loads .env.local automatically.

export function appBaseURL(): string {
  return process.env.APP_BASE_URL || 'http://localhost:3000'
}

// webhookSecret is REQUIRED for the lead intake endpoint. Missing secret means
// the endpoint refuses everything — fail closed, never open.
export function webhookSecret(): string {
  return process.env.CRM_WEBHOOK_SECRET || ''
}

// Google OAuth client. Both REQUIRED for sign-in; missing values mean the
// login route refuses everything — fail closed, never open.
export function googleClientID(): string {
  return process.env.GOOGLE_CLIENT_ID || ''
}

export function googleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET || ''
}

// VAPID keys for Web Push (raw P-256, base64url — generate: npm run vapid).
// Both REQUIRED for push; missing values mean subscribe refuses and no push
// ever sends — fail closed, never open.
export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || ''
}

export function vapidPrivateKey(): string {
  return process.env.VAPID_PRIVATE_KEY || ''
}

// Contact claim inside the VAPID JWT; push services use it to reach the
// operator if the sender misbehaves.
export function vapidSubject(): string {
  return process.env.VAPID_SUBJECT || 'mailto:woodchuckerstrees719@gmail.com'
}

// The marketing site's health endpoint. Unset ⇒ polling disabled.
export function siteHealthURL(): string {
  return process.env.SITE_HEALTH_URL || ''
}

// Resend transactional email (review requests, reminders, quotes). Unset ⇒
// email is "not configured" and those actions no-op instead of failing.
export function resendApiKey(): string {
  return process.env.RESEND_API_KEY || ''
}

export function mailFrom(): string {
  return process.env.MAIL_FROM || 'Woodchuckers <onboarding@resend.dev>'
}

// Where the "leave us a review" button points. Defaults to the links page
// (Google/Nextdoor/socials all live there); set to a direct Google review
// link to send customers straight to the star rating.
export function reviewURL(): string {
  return process.env.REVIEW_URL || 'https://woodchuckers-links.fly.dev/'
}

// Shared token for the external uptime checker's webhook. Unset ⇒ the
// endpoint refuses everything — fail closed, never open.
export function uptimeWebhookToken(): string {
  return process.env.UPTIME_WEBHOOK_TOKEN || ''
}

// Signing key for the stateless session JWT (HS256). REQUIRED: without it,
// sign-in fails closed — no token can be minted or verified. Generate with
// openssl rand -hex 32 and set the SAME value everywhere the app runs.
export function sessionSecret(): string {
  return process.env.SESSION_SECRET || ''
}

// Emails allowed to auto-provision a user row on first Google sign-in.
// Anyone else must already exist in the users table (scripts/createuser.ts).
export function googleAllowedEmails(): string[] {
  return (process.env.GOOGLE_ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}
