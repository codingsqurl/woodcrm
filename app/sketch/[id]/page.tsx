// Sketch editor — a near-fullscreen Excalidraw canvas for one sketch.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '../../../lib/session'
import { sketchById } from '../../../lib/sketches'
import { SketchCanvas } from './canvas'

export const dynamic = 'force-dynamic'

export default async function SketchPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const nid = Number(id)
  if (!Number.isInteger(nid)) notFound()
  const sketch = sketchById(nid)
  if (!sketch) notFound()

  return (
    <div className="sketch-page">
      <header className="sketch-head">
        <Link href={sketch.lead_id ? `/leads/${sketch.lead_id}` : '/sketch'} className="back">
          ← Back
        </Link>
        <span className="sketch-title">{sketch.title}</span>
      </header>
      <SketchCanvas id={sketch.id} initialScene={sketch.scene} />
    </div>
  )
}
