// instrumentation.ts — Next runs register() once per server start: the right
// (and only) place to kick off the in-process loops. Guarded to the Node
// runtime; better-sqlite3 is a native addon and must never load on Edge.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startReminderLoop } = await import('./lib/reminders')
    const { startHealthLoop } = await import('./lib/health')
    startReminderLoop()
    startHealthLoop()
  }
}
