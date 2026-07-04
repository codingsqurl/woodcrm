import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentUser } from '../../lib/session'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in — Woodchuckers CRM' }
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  if (await currentUser()) redirect('/')
  return (
    <main className="login">
      <span className="wordmark">
        Woodchuckers <em>CRM</em>
      </span>
      <LoginForm />
    </main>
  )
}
