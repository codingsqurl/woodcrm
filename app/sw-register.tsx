'use client'
import { useEffect } from 'react'

// ServiceWorkerRegister registers /sw.js (required for Web Push) after mount.
// A client effect, not an inline <script>: the old inline tag carried a CSP
// nonce that the server rendered but the browser strips before hydration, so
// React saw nonce="..." vs nonce="" and errored (the dev "1 Issue"). No inline
// script means no nonce to mismatch, and Next bundles this under the CSP fine.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
