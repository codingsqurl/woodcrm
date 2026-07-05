# Woodchuckers CRM

Pipeline, jobs, and follow-ups for a solo contract climber. Installable iPhone
app (home-screen PWA) with zero App Store, zero Apple developer account.

Sister repo: **Woodchuckers719** (the public site). Leads are born there and
delivered here over a signed, retried webhook. Two repos, **one system of
record** — this one.

## Architecture

Same operating philosophy as the site, on purpose: Next 15 App Router,
better-sqlite3 (single writer, WAL, prepared statements at module load), raw
SQL migrations, server-side opaque-token sessions, in-memory rate limiting,
exactly **one** Fly machine. If any of that surprises you, read the comments in
`lib/` — every constraint is written down where it lives.

```
site (repo A)                       crm (this repo)
─────────────                       ───────────────
estimate/contract form              POST /api/webhooks/leads
  └─ tx: insert lead                  ├─ verify HMAC(ts.body), ±5min skew
     + outbox row      ──signed──▶    ├─ dedupe on event_id (receipts)
outbox pump: retry w/ backoff         └─ tx: insert lead + 'new' event
                                    pipeline UI: new → contacted → quoted
                                      → scheduled → done → paid (or lost)
```

Money is integer cents. Time is unix epoch seconds. Every stage change is a
transaction that also appends to `pipeline_events` — the audit trail is not
optional equipment.

## Run it

```bash
npm install
cp .env.example .env.local        # set CRM_WEBHOOK_SECRET (openssl rand -hex 32)
npm run dev
```

Sign-in is **Google OAuth** — no passwords anywhere. Create a *Web
application* OAuth client at
[console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials),
add `<APP_BASE_URL>/api/auth/google/callback` as an authorized redirect URI
(one per environment, e.g. `http://localhost:3000/api/auth/google/callback`),
then set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.local`. Allow
yourself in either way:

```bash
# option A: pre-create the row
npm run createuser you@example.com "Your Name"
# option B: let first sign-in create it
echo 'GOOGLE_ALLOWED_EMAILS=you@example.com' >> .env.local
```

Deploy: `fly launch` with the included `Dockerfile`/`fly.toml`, create the
`data` volume, `fly secrets set CRM_WEBHOOK_SECRET=... GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=... GOOGLE_ALLOWED_EMAILS=...`. One machine. Ever.

## Put it on the iPhone

Open the deployed URL in Safari → Share → **Add to Home Screen**. Standalone
full-screen app, spruce-and-orange icon, live pipeline. Installed PWAs get Web
Push on iOS 16.4+ — the subscription plumbing (`push_subscriptions`, `sw.js`)
is already in place for the reminders milestone.

## Wire the site to it

Everything the site needs is in `patches/woodchuckers719/` — the outbox
migration, `lib/outbox.ts`, and `INTEGRATION.md` with the exact hook points.
Rule: lead row + outbox row commit in the same transaction. Delivery retries;
duplicates are no-ops (the CRM dedupes on `event_id`). Run the failure drill in
the integration doc once, so you trust the pipe before it matters.

## Roadmap (in priority order — resist reordering it)

1. **Lead inbox + pipeline** — shipped in this scaffold.
2. **Job scheduling calendar** — shipped: month calendar + day agenda at
   `/jobs`, appointments wired to pipeline leads.
3. **Follow-up reminders** — shipped: tasks on the lead page (`lib/tasks.ts`),
   the 🔔 subscribe toggle on the pipeline header, and an in-process due-task
   check (`lib/reminders.ts`, plain interval — single machine, same reasoning
   as the rate limiter). Web Push is hand-rolled on node:crypto in
   `lib/push.ts` (VAPID RFC 8292 + aes128gcm RFC 8291); `npm run selftest:push`
   proves the crypto round-trip. Setup: `npm run vapid`, paste the pair into
   `.env.local` / fly secrets, toggle alerts on from the installed PWA.
4. **Site health alerts** — shipped: `lib/health.ts` polls the site's
   `/healthz` (SITE_HEALTH_URL, 3 misses = down), and an external uptime
   checker can POST `/api/webhooks/health?token=…&status=down|up`. Both paths
   share one state machine, pushes fire on transitions only. The patient never
   takes its own pulse.

Explicit non-goals now the above shipped: SMS (A2P 10DLC is weeks of
paperwork), email sequences, invoicing (integrate Square/Stripe, never build
billing).
