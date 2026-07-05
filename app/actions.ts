'use server'
// Server actions for the pipeline. Every mutation re-checks the session —
// actions are public HTTP endpoints, the UI hiding a button secures nothing.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser, endSession } from '../lib/session'
import { addLeadNote, isStage, moveLeadStage, leadByID } from '../lib/leads'
import { createTask, completeTask, taskByID } from '../lib/tasks'
import { parseLocalDateTime } from '../lib/format'

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

export async function createTaskAction(formData: FormData): Promise<void> {
  await requireUser()
  const leadID = Number(formData.get('lead_id'))
  const title = String(formData.get('title') ?? '')
    .trim()
    .slice(0, 200)
  const date = String(formData.get('date') ?? '')
  const time = String(formData.get('time') ?? '09:00')
  if (!Number.isInteger(leadID) || !title || !leadByID(leadID)) return
  const dueAt = parseLocalDateTime(date, time)
  if (!dueAt) return
  createTask(leadID, title, dueAt)
  revalidatePath(`/leads/${leadID}`)
}

export async function completeTaskAction(formData: FormData): Promise<void> {
  await requireUser()
  const id = Number(formData.get('task_id'))
  if (!Number.isInteger(id)) return
  const task = taskByID(id)
  if (!task) return
  completeTask(id)
  if (task.lead_id) revalidatePath(`/leads/${task.lead_id}`)
}

export async function logoutAction(): Promise<void> {
  await endSession()
  redirect('/login')
}
