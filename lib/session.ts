// session.ts — stateless sessions: a signed JWT (HS256) in an HttpOnly cookie,
// no server-side sessions table. The cookie carries only the user id (JWT
// `sub`); every request verifies the signature, then hydrates the user from
// the DB — so userByID's `active = 1` filter still logs out a deactivated
// account instantly. What statelessness costs: no per-session revoke (a leaked
// token stays valid until it expires); deactivating the user, or rotating
// SESSION_SECRET, are the revocation levers.
//
// Cookie writes (set/clear) only happen inside Server Actions / Route Handlers,
// where next/headers permits it; currentUser is a read, usable anywhere.
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SignJWT, jwtVerify } from 'jose'
import { userByID, type User } from './auth'
import { sessionSecret } from './env'

export const SESSION_COOKIE = 'crm_session'
const SESSION_TTL_S = 30 * 24 * 60 * 60 // 30 days: it's your phone, stay logged in

// The HMAC key as bytes, or null when SESSION_SECRET is unset (fail closed).
function key(): Uint8Array | null {
  const s = sessionSecret()
  return s ? new TextEncoder().encode(s) : null
}

export async function startSession(userID: number): Promise<void> {
  const k = key()
  if (!k) throw new Error('SESSION_SECRET is not set; cannot start a session')
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userID))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_S}s`)
    .sign(k)
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(Date.now() + SESSION_TTL_S * 1000),
    path: '/',
  })
}

export async function endSession(): Promise<void> {
  // Stateless: nothing to delete server-side, just drop the cookie.
  const jar = await cookies()
  jar.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
}

// currentUser verifies the JWT and resolves it to a live, active user, or null.
// Any bad/expired/forged token resolves to null — jwtVerify throws, we swallow.
export async function currentUser(): Promise<User | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const k = key()
  if (!k) return null
  try {
    const { payload } = await jwtVerify(token, k, { algorithms: ['HS256'] })
    const id = Number(payload.sub)
    if (!Number.isInteger(id) || id <= 0) return null
    return userByID(id)
  } catch {
    return null
  }
}

// requireUser gates a page/action: bounce to /login if unauthenticated.
export async function requireUser(): Promise<User> {
  const user = await currentUser()
  if (!user) redirect('/login')
  return user
}
