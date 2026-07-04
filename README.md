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
npm run createuser you@example.com "Your Name" "a-long-password-here"
npm run dev
```

Deploy: `fly launch` with the included `Dockerfile`/`fly.toml`, create the
`data` volume, `fly secrets set CRM_WEBHOOK_SECRET=...`. One machine. Ever.

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
2. **Job scheduling calendar** — `jobs` table exists; build a day/week agenda
   list (not a month grid) at `/jobs`.
3. **Follow-up reminders** — `tasks` + `push_subscriptions` tables exist; add
   VAPID keys, a subscribe button, and an in-process due-task check (single
   machine ⇒ a plain interval is correct, same as the rate limiter).
4. **Site health alerts** — poll the site's `/healthz`; external uptime checker
   webhooks in; both paths end in a push. The patient never takes its own pulse.

Explicit non-goals until the above ship: SMS (A2P 10DLC is weeks of paperwork),
email sequences, invoicing (integrate Square/Stripe, never build billing).
