// GET /api/auth/google/callback — Google redirects back here. Verify state,
// trade the code for an identity, then gate: the email must already have a
// users row, or be listed in GOOGLE_ALLOWED_EMAILS (auto-provisions the row).
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { createUser, userByEmail } from '../../../../../lib/auth'
import { googleAllowedEmails } from '../../../../../lib/env'
import { exchangeCode, type GoogleIdentity } from '../../../../../lib/google'
import { startSession } from '../../../../../lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<never> {
  const jar = await cookies()
  const expectedState = jar.get('crm_oauth_state')?.value
  const verifier = jar.get('crm_oauth_verifier')?.value
  jar.delete('crm_oauth_state')
  jar.delete('crm_oauth_verifier')

  const params = req.nextUrl.searchParams
  const code = params.get('code')
  const state = params.get('state')
  if (params.get('error') || !code) redirect('/login?error=denied')
  if (!state || !expectedState || state !== expectedState || !verifier) {
    redirect('/login?error=state')
  }

  let identity: GoogleIdentity
  try {
    identity = await exchangeCode(code, verifier)
  } catch (err) {
    console.error('google oauth callback:', err)
    redirect('/login?error=google')
  }
  if (!identity.emailVerified) redirect('/login?error=unverified')

  const email = identity.email.toLowerCase()
  let user = userByEmail(email)
  if (!user && googleAllowedEmails().includes(email)) {
    user = createUser(email, identity.name)
  }
  if (!user) redirect('/login?error=unauthorized')

  await startSession(user.id)
  redirect('/')
}
