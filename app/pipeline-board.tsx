'use client'
// The interactive pipeline board. Cards drag between stage columns on desktop
// (HTML5 drag-and-drop); the Mark/Lost buttons stay as the touch fallback,
// since HTML5 DnD doesn't fire on phones. Every move routes through the same
// moveStageAction the rest of the app uses, then refreshes to re-read the DB.
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { money, timeAgo } from '../lib/format'
import { moveStageAction } from './actions'

type BoardLead = {
  id: number
  name: string
  email: string
  phone: string
  summary: string
  source: string
  stage: string
  value_cents: number | null
  updated_at: number
  next: string | null
}

type Group = { stage: string; n: number; cents: number; leads: BoardLead[] }

export function PipelineBoard({ groups }: { groups: Group[] }) {
  const router = useRouter()
  const [dragId, setDragId] = useState<number | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function move(leadId: number, to: string) {
    setPending(true)
    const fd = new FormData()
    fd.set('lead_id', String(leadId))
    fd.set('to', to)
    try {
      await moveStageAction(fd)
    } finally {
      setDragId(null)
      setOverStage(null)
      setPending(false)
      router.refresh()
    }
  }

  const leadStage = (id: number) => groups.flatMap((g) => g.leads).find((l) => l.id === id)?.stage

  return (
    <div className={`board${pending ? ' board-pending' : ''}`}>
      {groups.map((g) => (
        <section
          key={g.stage}
          id={`stage-${g.stage}`}
          className={`stage-group${overStage === g.stage ? ' drop-over' : ''}`}
          data-stage={g.stage}
          onDragOver={(e) => {
            if (dragId != null) {
              e.preventDefault()
              if (overStage !== g.stage) setOverStage(g.stage)
            }
          }}
          onDragLeave={() => setOverStage((s) => (s === g.stage ? null : s))}
          onDrop={(e) => {
            e.preventDefault()
            if (dragId != null && leadStage(dragId) !== g.stage) move(dragId, g.stage)
            else {
              setDragId(null)
              setOverStage(null)
            }
          }}
        >
          <header className="stage-head">
            <h2 className="stage-name">{g.stage}</h2>
            <span className="stage-n">{g.n}</span>
            <span className={`stage-cents${g.stage === 'paid' ? ' paid' : ''}`}>{money(g.cents)}</span>
          </header>

          {g.leads.length === 0 ? (
            <p className="ghost">
              No leads in <span className="cap">{g.stage}</span>
            </p>
          ) : (
            <div className="cards">
              {g.leads.map((lead) => (
                <article
                  key={lead.id}
                  className={`card${dragId === lead.id ? ' dragging' : ''}`}
                  data-stage={lead.stage}
                  draggable
                  onDragStart={() => setDragId(lead.id)}
                  onDragEnd={() => {
                    setDragId(null)
                    setOverStage(null)
                  }}
                >
                  <Link href={`/leads/${lead.id}`} draggable={false}>
                    <div className="row1">
                      <span className="who">
                        {lead.name || lead.email || lead.phone || 'Unknown'}
                      </span>
                      <span className={`value${lead.stage === 'paid' ? ' paid' : ''}`}>
                        {money(lead.value_cents)}
                      </span>
                    </div>
                    {lead.summary ? <p className="summary">{lead.summary}</p> : null}
                    <div className="meta">
                      <span>{lead.source}</span>
                      <span>{timeAgo(lead.updated_at)}</span>
                    </div>
                  </Link>
                  {lead.next ? (
                    <div className="actions">
                      <button
                        className="btn btn-advance"
                        type="button"
                        disabled={pending}
                        onClick={() => move(lead.id, lead.next as string)}
                      >
                        Mark {lead.next}
                      </button>
                      <button
                        className="btn btn-quiet"
                        type="button"
                        disabled={pending}
                        onClick={() => move(lead.id, 'lost')}
                      >
                        Lost
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
