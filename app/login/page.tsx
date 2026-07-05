import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentUser } from '../../lib/session'
import { devLoginAction } from './dev-login'

export const metadata: Metadata = { title: 'Sign in — Woodchuckers CRM' }
export const dynamic = 'force-dynamic'

const ERRORS: Record<string, string> = {
  denied: 'Google sign-in was cancelled.',
  state: 'Sign-in expired or was tampered with. Try again.',
  google: 'Google didn’t complete the sign-in. Try again.',
  unverified: 'That Google account’s email isn’t verified.',
  unauthorized: 'That Google account isn’t allowed in this CRM.',
  ratelimit: 'Too many attempts. Wait a minute and try again.',
  config: 'Google sign-in isn’t configured on the server.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (await currentUser()) redirect('/')
  const { error } = await searchParams
  const message = error ? (ERRORS[error] ?? 'Sign-in failed. Try again.') : ''
  return (
    <main className="login">
      <span className="wordmark">
        Woodchuckers <em>CRM</em>
      </span>
      {message ? <p className="error">{message}</p> : null}
      <a className="btn btn-advance" href="/api/auth/google">
        Continue with Google
      </a>
      {process.env.NODE_ENV !== 'production' ? (
        <form action={devLoginAction}>
          <button className="btn btn-quiet" type="submit">
            Dev sign-in (local only)
          </button>
        </form>
      ) : null}
    </main>
  )
}
