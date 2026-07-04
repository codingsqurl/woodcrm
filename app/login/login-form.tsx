'use client'
import { useActionState } from 'react'
import { loginAction, type LoginState } from './actions'

const initial: LoginState = { error: '' }

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial)
  return (
    <form action={action}>
      <input
        type="email"
        name="email"
        placeholder="Email"
        autoComplete="username"
        required
        autoFocus
      />
      <input
        type="password"
        name="password"
        placeholder="Password"
        autoComplete="current-password"
        required
      />
      {state.error ? <p className="error">{state.error}</p> : null}
      <button className="btn btn-advance" type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
