// google.ts — minimal Google OpenID Connect client (authorization-code flow
// with PKCE). No SDK: the whole flow is two endpoints and a JWT payload.
//
// Trust model: the id_token arrives over TLS directly from Google's token
// endpoint in exchange for our client_secret, so per OIDC Core §3.1.3.7 the
// TLS channel authenticates the issuer and we may skip signature validation.
// We still check iss / aud / exp.
import { createHash, randomBytes } from 'node:crypto'
import { appBaseURL, googleClientID, googleClientSecret } from './env'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

export type GoogleIdentity = {
  sub: string
  email: string
  emailVerified: boolean
  name: string
}

export function redirectURI(): string {
  return `${appBaseURL()}/api/auth/google/callback`
}

export function newState(): string {
  return randomBytes(16).toString('hex')
}

export function newCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export function authURL(state: string, codeVerifier: string): string {
  const challenge = createHash('sha256').update(codeVerifier).digest('base64url')
  const params = new URLSearchParams({
    client_id: googleClientID(),
    redirect_uri: redirectURI(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return `${AUTH_ENDPOINT}?${params}`
}

// exchangeCode trades the authorization code for tokens and returns the
// validated identity claims from the id_token. Throws on any failure —
// callers translate to a login error.
export async function exchangeCode(code: string, codeVerifier: string): Promise<GoogleIdentity> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: googleClientID(),
      client_secret: googleClientSecret(),
      redirect_uri: redirectURI(),
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  })
  if (!res.ok) {
    throw new Error(`token exchange failed: ${res.status} ${await res.text()}`)
  }
  const body = (await res.json()) as { id_token?: string }
  if (!body.id_token) throw new Error('token response missing id_token')
  return parseIDToken(body.id_token)
}

function parseIDToken(idToken: string): GoogleIdentity {
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('malformed id_token')
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
    iss?: string
    aud?: string
    exp?: number
    sub?: string
    email?: string
    email_verified?: boolean
    name?: string
  }
  if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') {
    throw new Error(`unexpected issuer: ${claims.iss}`)
  }
  if (claims.aud !== googleClientID()) throw new Error('id_token audience mismatch')
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error('id_token expired')
  if (!claims.sub || !claims.email) throw new Error('id_token missing sub/email')
  return {
    sub: claims.sub,
    email: claims.email,
    emailVerified: claims.email_verified === true,
    name: claims.name || claims.email,
  }
}
