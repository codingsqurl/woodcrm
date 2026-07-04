'use server'
// Server actions for the pipeline. Every mutation re-checks the session —
// actions are public HTTP endpoints, the UI hiding a button secures nothing.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser, endSession } from '../lib/session'
import { addLeadNote, isStage, moveLeadStage } from '../lib/leads'

export async function moveStageAction(formData: FormData): Promise<void> {
  await requireUser()
  const id = Number(formData.get('lead_id'))
  const to = String(formData.get('to') ?? '')
  if (!Number.isInteger(id) || !isStage(to)) return
  moveLeadStage(id, to)
  revalidatePath('/')
  revalidatePath(`/leads/${id}`)
}

export async function addNoteAction(formData: FormData): Promise<void> {
  await requireUser()
  const id = Number(formData.get('lead_id'))
  const body = String(formData.get('body') ?? '').trim()
  if (!Number.isInteger(id) || !body || body.length > 4000) return
  addLeadNote(id, body)
  revalidatePath(`/leads/${id}`)
}

export async function logoutAction(): Promise<void> {
  await endSession()
  redirect('/login')
}
