import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Woodchuckers CRM',
  description: 'Pipeline, jobs, and follow-ups for Woodchuckers contract climbing.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'WC CRM' },
}

export const viewport: Viewport = {
  themeColor: '#18211B',
  width: 'device-width',
  initialScale: 1,
  // The pipeline is an app, not a page — pinch-zoom off keeps taps crisp.
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // CSP nonce from middleware so the SW-registration inline script is allowed.
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <html lang="en">
      <body>
        {children}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`,
          }}
        />
      </body>
    </html>
  )
}
