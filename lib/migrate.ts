// migrate.ts — applies pending db/migrations/*.sql in sorted order, tracked in
// schema_migrations so each runs at most once. Each migration and its tracking
// row commit in ONE transaction: a crash between exec and record must never
// leave a migration applied-but-untracked (re-running CREATE/ALTER throws at
// module load and 500s every request). Same recipe as the site.
import type DatabaseType from 'better-sqlite3'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations')

export function runMigrations(db: DatabaseType.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`)

  const applied = new Set<string>(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[]).map(
      (r) => r.version,
    ),
  )

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const record = db.prepare('INSERT INTO schema_migrations (version) VALUES (?)')

  const applyOne = db.transaction((sql: string, version: string) => {
    db.exec(sql)
    record.run(version)
  })

  for (const f of files) {
    if (applied.has(f)) continue
    const raw = readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')
    applyOne(stripOuterTx(raw), f)
  }
}

// stripOuterTx removes a file's own BEGIN;/COMMIT; so its statements run inside
// our transaction (SQLite rejects nested BEGIN). Trigger bodies are unaffected:
// their BEGIN is not followed by a bare semicolon and closes with END;.
function stripOuterTx(sql: string): string {
  return sql.replace(/\bBEGIN(\s+TRANSACTION)?\s*;/i, '').replace(/\bCOMMIT\s*;\s*$/i, '')
}
