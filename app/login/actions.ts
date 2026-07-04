'use server'
import { redirect } from 'next/navigation'
import { verifyCredentials } from '../../lib/auth'
import { clientIP, loginRL } from '../../lib/ratelimit'
import { startSession } from '../../lib/session'

export type LoginState = { error: string }

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const ip = await clientIP()
  if (!loginRL.allow(ip)) {
    return { error: 'Too many attempts. Wait a minute and try again.' }
  }

  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const user = verifyCredentials(email, password)
  if (!user) {
    return { error: 'Email and password don’t match.' }
  }

  await startSession(user.id)
  redirect('/')
}
