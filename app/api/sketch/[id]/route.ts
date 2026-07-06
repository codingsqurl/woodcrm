// POST /api/sketch/[id] — the canvas autosaves its serialized Excalidraw scene
// here. Operator-only (session-gated), size-capped so a runaway scene can't
// bloat the row.
import type { NextRequest } from 'next/server'
import { currentUser } from '../../../../lib/session'
import { sketchById, saveScene } from '../../../../lib/sketches'

export const dynamic = 'force-dynamic'

const MAX_SCENE_BYTES = 8_000_000 // ~8MB — generous for a job-site sketch

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const nid = Number(id)
  if (!Number.isInteger(nid) || !sketchById(nid)) {
    return Response.json({ error: 'not found' }, { status: 404 })
  }
  const scene = await req.text()
  if (scene.length > MAX_SCENE_BYTES) return Response.json({ error: 'too large' }, { status: 413 })
  saveScene(nid, scene)
  return Response.json({ ok: true })
}
