// New note — title (prefilled when arriving from an unresolved [[wiki-link]])
// plus a markdown body.
import Link from 'next/link'
import { requireUser } from '../../../lib/session'
import { createNoteAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ title?: string }> }

export default async function NewNotePage({ searchParams }: Props) {
  await requireUser()
  const { title } = await searchParams

  return (
    <div className="shell">
      <Link href="/notes" className="back">
        ← Second brain
      </Link>
      <h1 className="page-h1">New note</h1>
      <form action={createNoteAction} className="note-edit">
        <input
          type="text"
          name="title"
          defaultValue={title ?? ''}
          placeholder="Title (e.g. Day-rate playbook)"
          maxLength={200}
          required
          autoFocus
        />
        <textarea
          name="body"
          rows={16}
          maxLength={20000}
          placeholder={'Write in markdown. Link other notes with [[Title]].\n\n# Heading\n- a point\n**bold**, *italic*, `code`.'}
        />
        <button className="btn btn-advance" type="submit">
          Create note
        </button>
      </form>
    </div>
  )
}
