'use client'
// The Excalidraw canvas. Client-only (Excalidraw needs the DOM), loaded via a
// dynamic import with ssr:false. On change it debounces, then POSTs the
// serialized scene to /api/sketch/[id]. On load it restores the saved elements,
// files, and background.
import '@excalidraw/excalidraw/index.css'
import dynamic from 'next/dynamic'
import { useCallback, useRef, useState } from 'react'

const Excalidraw = dynamic(async () => (await import('@excalidraw/excalidraw')).Excalidraw, {
  ssr: false,
  loading: () => <p className="sketch-loading">Loading canvas…</p>,
})

export function SketchCanvas({ id, initialScene }: { id: number; initialScene: string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saved, setSaved] = useState(true)

  // Parsed from stored JSON, so it's dynamic; hand it to Excalidraw as its
  // loose initial-data shape rather than fighting the full element types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialData: any
  try {
    if (initialScene) {
      const p = JSON.parse(initialScene)
      initialData = {
        elements: p.elements ?? [],
        files: p.files,
        appState: { viewBackgroundColor: p.background ?? '#ffffff' },
      }
    }
  } catch {
    initialData = undefined
  }

  const onChange = useCallback(
    (elements: readonly unknown[], appState: { viewBackgroundColor?: string }, files: unknown) => {
      setSaved(false)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        const scene = JSON.stringify({ elements, files, background: appState?.viewBackgroundColor })
        fetch(`/api/sketch/${id}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: scene,
          keepalive: true,
        })
          .then(() => setSaved(true))
          .catch(() => {})
      }, 800)
    },
    [id],
  )

  return (
    <div className="sketch-canvas">
      <span className={`sketch-status${saved ? ' ok' : ''}`}>{saved ? 'Saved' : 'Saving…'}</span>
      <Excalidraw initialData={initialData} onChange={onChange} />
    </div>
  )
}
