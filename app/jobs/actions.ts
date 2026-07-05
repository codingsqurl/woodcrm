'use server'
// Server actions for the schedule. Same rule as the pipeline: every mutation
// re-checks the session — actions are public HTTP endpoints.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '../../lib/session'
import { createJob, isJobStatus, jobByID, rescheduleJob, setJobStatus } from '../../lib/jobs'
import { leadByID } from '../../lib/leads'
import { parseLocalDateTime as parseLocal } from '../../lib/format'

export async function createJobAction(formData: FormData): Promise<void> {
  await requireUser()

  const title = String(formData.get('title') ?? '')
    .trim()
    .slice(0, 200)
  const address = String(formData.get('address') ?? '')
    .trim()
    .slice(0, 300)
  const date = String(formData.get('date') ?? '')
  const time = String(formData.get('time') ?? '08:00')
  const days = Math.min(Math.max(Number(formData.get('days') ?? 1) || 1, 1), 30)
  const rate = String(formData.get('day_rate') ?? '').trim()
  const leadRaw = Number(formData.get('lead_id'))
  // Only attach a lead that actually exists — the jobs table enforces the FK.
  const leadID = Number.isInteger(leadRaw) && leadRaw > 0 && leadByID(leadRaw) ? leadRaw : null

  const startsAt = title ? parseLocal(date, time) : null
  if (!startsAt) return

  const rateCents = rate === '' ? null : Math.trunc(Number(rate) * 100)
  createJob({
    lead_id: leadID,
    title,
    address,
    starts_at: startsAt,
    ends_at: startsAt + days * 86400,
    day_rate_cents: Number.isFinite(rateCents) ? rateCents : null,
  })

  revalidatePath('/jobs')
  if (leadID) revalidatePath(`/leads/${leadID}`)
  redirect(`/jobs?d=${date}`)
}

export async function setJobStatusAction(formData: FormData): Promise<void> {
  await requireUser()
  const id = Number(formData.get('job_id'))
  const status = String(formData.get('status') ?? '')
  if (!Number.isInteger(id) || !isJobStatus(status)) return
  setJobStatus(id, status)
  revalidatePath('/jobs')
}

export async function rescheduleJobAction(formData: FormData): Promise<void> {
  await requireUser()
  const id = Number(formData.get('job_id'))
  const date = String(formData.get('date') ?? '')
  const time = String(formData.get('time') ?? '08:00')
  if (!Number.isInteger(id)) return
  const job = jobByID(id)
  const startsAt = parseLocal(date, time)
  if (!job || !startsAt) return
  // Preserve the original duration when one was set.
  const duration = job.ends_at ? job.ends_at - job.starts_at : null
  rescheduleJob(id, startsAt, duration ? startsAt + duration : null)
  revalidatePath('/jobs')
  redirect(`/jobs?d=${date}`)
}
