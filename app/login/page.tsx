import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentUser } from '../../lib/session'
import { accessLoginAction } from './access-login'
import { devLoginAction } from './dev-login'

export const metadata: Metadata = { title: 'Sign in — Woodchuckers CRM' }
export const dynamic = 'force-dynamic'

const ERRORS: Record<string, string> = {
  badkey: 'Wrong access key.',
  ratelimit: 'Too many attempts. Wait a minute and try again.',
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
      <form action={accessLoginAction} className="login-form">
        <input
          type="password"
          name="key"
          placeholder="Access key"
          autoComplete="current-password"
          autoFocus
          required
        />
        <button className="btn btn-advance" type="submit">
          Unlock
        </button>
      </form>
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
