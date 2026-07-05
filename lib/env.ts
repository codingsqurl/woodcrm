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

// Emails allowed to auto-provision a user row on first Google sign-in.
// Anyone else must already exist in the users table (scripts/createuser.ts).
export function googleAllowedEmails(): string[] {
  return (process.env.GOOGLE_ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}
