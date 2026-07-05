// GET /api/auth/google — kick off the Google sign-in redirect. State + PKCE
// verifier live in short-lived HttpOnly cookies until the callback consumes
// them.
import { NextResponse } from 'next/server'
import { appBaseURL, googleClientID, googleClientSecret } from '../../../../lib/env'
import { authURL, newCodeVerifier, newState } from '../../../../lib/google'
import { clientIP, loginRL } from '../../../../lib/ratelimit'

export const dynamic = 'force-dynamic'

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 600, // ten minutes to finish the Google hop
  path: '/',
}

export async function GET(): Promise<NextResponse> {
  if (!loginRL.allow(await clientIP())) {
    return NextResponse.redirect(new URL('/login?error=ratelimit', appBaseURL()))
  }
  // Fail closed: no configured client, no login attempt.
  if (!googleClientID() || !googleClientSecret()) {
    return NextResponse.redirect(new URL('/login?error=config', appBaseURL()))
  }

  const state = newState()
  const verifier = newCodeVerifier()
  const res = NextResponse.redirect(authURL(state, verifier))
  res.cookies.set('crm_oauth_state', state, COOKIE_OPTS)
  res.cookies.set('crm_oauth_verifier', verifier, COOKIE_OPTS)
  return res
}
