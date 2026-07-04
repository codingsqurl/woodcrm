// sw.js — minimal service worker: exists so the installed app can receive Web
// Push (iOS 16.4+) once subscriptions ship. No fetch caching yet — a CRM must
// show live data; stale pipeline is worse than a spinner.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Woodchuckers CRM', {
      body: data.body || '',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || '/'))
})
