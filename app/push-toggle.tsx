'use client'
// push-toggle.tsx — the subscribe button (roadmap #3). One tap turns Web Push
// on for THIS device: ask permission, subscribe through the already-registered
// service worker, hand the subscription to the server. Renders nothing when
// the browser can't push (or VAPID isn't configured) — a dead toggle is noise.
import { useEffect, useState } from 'react'

type State = 'checking' | 'unsupported' | 'off' | 'on' | 'busy'

function keyBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export function PushToggle({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!vapidKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (alive) setState('unsupported')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (alive) setState(sub ? 'on' : 'off')
    })().catch(() => {
      if (alive) setState('unsupported')
    })
    return () => {
      alive = false
    }
  }, [vapidKey])

  async function toggle() {
    if (state !== 'on' && state !== 'off') return
    const was = state
    setState('busy')
    try {
      const reg = await navigator.serviceWorker.ready
      if (was === 'on') {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
        setState('off')
        return
      }
      if ((await Notification.requestPermission()) !== 'granted') {
        setState('off')
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(vapidKey).buffer as ArrayBuffer,
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) {
        await sub.unsubscribe()
        setState('off')
        return
      }
      setState('on')
    } catch {
      setState(was)
    }
  }

  if (state === 'checking' || state === 'unsupported') return null
  return (
    <button type="button" onClick={toggle} disabled={state === 'busy'} aria-pressed={state === 'on'}>
      {state === 'on' ? '🔔 Alerts on' : '🔕 Alerts off'}
    </button>
  )
}
