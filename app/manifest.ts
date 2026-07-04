import type { MetadataRoute } from 'next'

// Home-screen PWA manifest. Share -> Add to Home Screen on iOS gives a
// standalone full-screen app; installed PWAs get Web Push on iOS 16.4+.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Woodchuckers CRM',
    short_name: 'WC CRM',
    description: 'Pipeline, jobs, and follow-ups for Woodchuckers contract climbing.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F3F4F0',
    theme_color: '#18211B',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
