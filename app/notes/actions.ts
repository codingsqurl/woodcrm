'use server'
// Second-brain note actions — behind the operator login like the rest of the
// CRM. Titles are unique (case-insensitive); creating or renaming to an
// existing title routes to that note instead of duplicating it.
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireUser } from '../../lib/session'
import { createNote, updateNote, noteByTitle } from '../../lib/brain'

export async function createNoteAction(formData: FormData): Promise<void> {
  await requireUser()
  const title = String(formData.get('title') ?? '').trim().slice(0, 200)
  const body = String(formData.get('body') ?? '').slice(0, 20000)
  if (!title) redirect('/notes')

  const existing = noteByTitle(title)
  if (existing) redirect(`/notes/${existing.id}`)

  const note = createNote(title, body)
  redirect(`/notes/${note.id}`)
}

export async function updateNoteAction(formData: FormData): Promise<void> {
  await requireUser()
  const id = Number(formData.get('id'))
  const title = String(formData.get('title') ?? '').trim().slice(0, 200)
  const body = String(formData.get('body') ?? '').slice(0, 20000)
  if (!Number.isInteger(id) || !title) return

  const other = noteByTitle(title)
  if (other && other.id !== id) redirect(`/notes/${id}?err=dup`)

  updateNote(id, title, body)
  revalidatePath(`/notes/${id}`)
  revalidatePath('/notes')
}
