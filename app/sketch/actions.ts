'use server'
// Create a sketch (standalone, or attached to a lead) and jump into the canvas.
import { redirect } from 'next/navigation'
import { requireUser } from '../../lib/session'
import { createSketch } from '../../lib/sketches'
import { leadByID } from '../../lib/leads'

export async function newSketchAction(formData: FormData): Promise<void> {
  await requireUser()
  const leadRaw = Number(formData.get('lead_id'))
  const leadId = Number.isInteger(leadRaw) && leadRaw > 0 && leadByID(leadRaw) ? leadRaw : null
  const title = String(formData.get('title') ?? '').trim().slice(0, 120) || 'Sketch'
  const sketch = createSketch(leadId, title)
  redirect(`/sketch/${sketch.id}`)
}
