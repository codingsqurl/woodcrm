// env.ts — config helpers. Next loads .env.local automatically.

export function appBaseURL(): string {
  return process.env.APP_BASE_URL || 'http://localhost:3000'
}

// webhookSecret is REQUIRED for the lead intake endpoint. Missing secret means
// the endpoint refuses everything — fail closed, never open.
export function webhookSecret(): string {
  return process.env.CRM_WEBHOOK_SECRET || ''
}
