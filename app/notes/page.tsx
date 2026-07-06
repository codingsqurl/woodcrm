// Second brain — the note index.
import Link from 'next/link'
import { requireUser } from '../../lib/session'
import { listNotes } from '../../lib/brain'
import { dateTimeShort } from '../../lib/format'
import { logoutAction } from '../actions'

export const dynamic = 'force-dynamic'

export default async function NotesPage() {
  await requireUser()
  const notes = listNotes()

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
        <h1 className="page-h1">Second brain</h1>
        <Link className="btn btn-advance" href="/notes/new">
          + New note
        </Link>
      </div>

      {notes.length === 0 ? (
        <p className="ghost">
          No notes yet. Start your playbook — pricing, species, area quirks, rigging notes. Link them
          with [[double brackets]].
        </p>
      ) : (
        <ul className="note-list">
          {notes.map((n) => (
            <li key={n.id}>
              <Link href={`/notes/${n.id}`}>{n.title}</Link>
              <span className="when">{dateTimeShort(n.updated_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
