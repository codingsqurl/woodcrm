// A single note — rendered markdown with live [[wiki-links]], the backlinks
// that point here, and an inline editor.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '../../../lib/session'
import { noteById, noteByTitle, backlinks, renderMarkdown } from '../../../lib/brain'
import { dateTimeShort } from '../../../lib/format'
import { updateNoteAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ err?: string }>
}

export default async function NotePage({ params, searchParams }: Props) {
  await requireUser()
  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id)) notFound()
  const note = noteById(id)
  if (!note) notFound()

  const { err } = await searchParams
  const html = renderMarkdown(note.body, noteByTitle)
  const linkers = backlinks(note.title)

  return (
    <div className="shell">
      <Link href="/notes" className="back">
        ← Second brain
      </Link>
      <h1 className="page-h1">{note.title}</h1>
      <p className="note-meta">Updated {dateTimeShort(note.updated_at)}</p>

      {note.body.trim() ? (
        <div className="note-body" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="ghost">Empty note. Open the editor below and start writing.</p>
      )}

      <section>
        <h2>Backlinks</h2>
        {linkers.length === 0 ? (
          <p className="ghost">Nothing links here yet.</p>
        ) : (
          <ul className="note-list">
            {linkers.map((n) => (
              <li key={n.id}>
                <Link href={`/notes/${n.id}`}>{n.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="note-editor">
        <summary className="btn btn-quiet">Edit</summary>
        {err === 'dup' ? <p className="error">Another note already has that title.</p> : null}
        <form action={updateNoteAction} className="note-edit">
          <input type="hidden" name="id" value={note.id} />
          <input type="text" name="title" defaultValue={note.title} maxLength={200} required />
          <textarea name="body" rows={16} maxLength={20000} defaultValue={note.body} />
          <button className="btn btn-advance" type="submit">
            Save
          </button>
        </form>
      </details>
    </div>
  )
}
