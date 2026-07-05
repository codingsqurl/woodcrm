import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ServiceWorkerRegister } from './sw-register'

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
