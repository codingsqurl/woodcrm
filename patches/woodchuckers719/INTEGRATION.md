# Wiring Woodchuckers719 → CRM

Three files, one rule: **the lead row and its outbox row commit in the same
transaction.** Delivery is somebody else's problem (the pump's).

## 1. Copy the files into the site repo

```
db/migrations/0010_outbox.sql   →  Woodchuckers719/db/migrations/0010_outbox.sql
lib/outbox.ts                   →  Woodchuckers719/lib/outbox.ts
```

The migration runs automatically on next boot (`runMigrations` picks it up).

## 2. Set the secrets (both sides, SAME secret)

```bash
openssl rand -hex 32   # generate once, use in both apps

# site
fly secrets set -a woodchuckers-springs \
  CRM_WEBHOOK_URL=https://woodchuckers-crm.fly.dev/api/webhooks/leads \
  CRM_WEBHOOK_SECRET=<hex>

# crm
fly secrets set -a woodchuckers-crm CRM_WEBHOOK_SECRET=<hex>
```

Unset = the outbox no-ops. The site never depends on the CRM to accept a lead.

## 3. Hook the enqueue into each lead-creating action

In `app/estimate/actions.ts` (and the contract-climbing action), find the
better-sqlite3 transaction that inserts the estimate. Add the enqueue INSIDE
it and the kick AFTER it:

```ts
import { enqueueLeadEvent, kickOutbox, startOutboxPump } from '../../lib/outbox'

const createEstimateTx = db.transaction((/* existing args */) => {
  // ...existing INSERT INTO estimates...
  enqueueLeadEvent({
    source: 'site:estimate',
    name: fullName,
    phone,
    email,
    summary: `${service} — ${address}`,
    payload: { estimateId, service, address /* whatever you already have */ },
  })
})

createEstimateTx(/* args */)
startOutboxPump() // idempotent; first call arms the 60s retry loop
kickOutbox()      // fire-and-forget immediate delivery
```

Same pattern for `app/contract-climbing/actions.ts` with `source: 'site:contract'`.

## 4. Verify

```bash
# watch the outbox drain
sqlite3 /data/woodchuckers.db \
  "SELECT id, kind, attempts, delivered_at, last_error FROM outbox ORDER BY id DESC LIMIT 5;"
```

Submit a test estimate → row appears with `delivered_at` set within seconds →
lead shows up in the CRM's `new` column. Kill the CRM machine, submit another →
row sits with a `last_error` and a growing backoff → restart CRM → it delivers.
That failure drill is not optional. Run it once so you trust the pipe.
