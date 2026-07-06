// Sketch index — every canvas, and a button to start a fresh one.
import Link from 'next/link'
import { requireUser } from '../../lib/session'
import { listSketches } from '../../lib/sketches'
import { dateTimeShort } from '../../lib/format'
import { logoutAction } from '../actions'
import { newSketchAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function SketchListPage() {
  await requireUser()
  const sketches = listSketches()

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="wordmark">
          Woodchuckers <em>CRM</em>
        </Link>
        <nav className="topnav">
          <Link href="/">Pipeline</Link>
          <form action={logoutAction}>
            <button type="submit">Sign out</button>
          </form>
        </nav>
      </header>

      <div className="notes-head">
        <h1 className="page-h1">Sketches</h1>
        <form action={newSketchAction}>
          <button className="btn btn-advance" type="submit">
            + New sketch
          </button>
        </form>
      </div>

      {sketches.length === 0 ? (
        <p className="ghost">No sketches yet. Start one to map a job site — trees, drop zones, rigging.</p>
      ) : (
        <ul className="note-list">
          {sketches.map((s) => (
            <li key={s.id}>
              <Link href={`/sketch/${s.id}`}>{s.title}</Link>
              <span className="when">{dateTimeShort(s.updated_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
