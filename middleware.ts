import { NextResponse, type NextRequest } from 'next/server'

// Security headers + per-request CSP nonce, same recipe as the site. This
// middleware never touches the database (better-sqlite3 is Node-only).
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const isDev = process.env.NODE_ENV !== 'production'

  const scriptSrc = `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`

  const csp = [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self'",
    scriptSrc,
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', csp)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('Content-Security-Policy', csp)
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'same-origin')
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon-|favicon.ico|sw.js).*)'],
}
