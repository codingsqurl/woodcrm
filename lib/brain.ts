// brain.ts — the second brain: standalone notes that cross-link by title with
// [[wiki-links]], plus backlinks and a small dependency-free markdown renderer.
// Single operator, personal notes, so the renderer favours simple + safe (HTML
// is escaped first) over full CommonMark. Titles are unique case-insensitively
// so a link resolves to exactly one note.
import { db, nowEpoch } from './db'

export type Note = {
  id: number
  title: string
  body: string
  created_at: number
  updated_at: number
}

const COLS = `id, title, body, created_at, updated_at`
const insertStmt = db.prepare(`INSERT INTO brain_notes (title, body) VALUES (?, ?)`)
const byIdStmt = db.prepare(`SELECT ${COLS} FROM brain_notes WHERE id = ?`)
const byTitleStmt = db.prepare(`SELECT ${COLS} FROM brain_notes WHERE title = ? COLLATE NOCASE`)
const listStmt = db.prepare(`SELECT ${COLS} FROM brain_notes ORDER BY updated_at DESC`)
const updateStmt = db.prepare(`UPDATE brain_notes SET title = ?, body = ?, updated_at = ? WHERE id = ?`)

export function createNote(title: string, body = ''): Note {
  const info = insertStmt.run(title, body)
  return byIdStmt.get(info.lastInsertRowid) as Note
}

export function noteById(id: number): Note | null {
  return (byIdStmt.get(id) as Note | undefined) ?? null
}

export function noteByTitle(title: string): Note | null {
  return (byTitleStmt.get(title) as Note | undefined) ?? null
}

export function listNotes(): Note[] {
  return listStmt.all() as Note[]
}

export function updateNote(id: number, title: string, body: string): void {
  updateStmt.run(title, body, nowEpoch(), id)
}

// ── wiki-links ───────────────────────────────────────────────────────────────
const LINK_RE = /\[\[([^\]]+)\]\]/g

// extractLinks pulls the [[Title]] targets out of a note body.
export function extractLinks(body: string): string[] {
  const out: string[] = []
  for (const m of body.matchAll(LINK_RE)) out.push(m[1].trim())
  return out
}

// backlinks: notes whose body links to `title`. Computed in JS (exact link
// match, case-insensitive) — a personal brain is small enough that scanning
// beats a fragile SQL LIKE.
export function backlinks(title: string): Note[] {
  const t = title.toLowerCase()
  return listNotes().filter(
    (n) => extractLinks(n.body).some((l) => l.toLowerCase() === t),
  )
}

// ── rendering ────────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// inline handles the within-a-line marks on already-escaped text: code, bold,
// italic, external links, then wiki-links (resolved to real notes or flagged
// unresolved so you can click to create them — Obsidian-style).
function inline(escaped: string, resolve: (title: string) => Note | null): string {
  let s = escaped
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // external links [text](http…) — only http(s) to keep it safe
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  // wiki-links [[Title]]
  s = s.replace(LINK_RE, (_m, raw: string) => {
    const title = raw.trim()
    const note = resolve(title)
    if (note) return `<a class="wikilink" href="/notes/${note.id}">${title}</a>`
    return `<a class="wikilink unresolved" href="/notes/new?title=${encodeURIComponent(title)}">${title}</a>`
  })
  return s
}

// renderMarkdown turns a note body into safe HTML. Line-based: #/##/### headings,
// "- " bullet lists, blank-line paragraphs; everything else is a paragraph.
export function renderMarkdown(body: string, resolve: (title: string) => Note | null): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let para: string[] = []
  let inList = false

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(escapeHtml(para.join(' ')), resolve)}</p>`)
      para = []
    }
  }
  const closeList = () => {
    if (inList) {
      html.push('</ul>')
      inList = false
    }
  }

  for (const line of lines) {
    const t = line.trim()
    const h = /^(#{1,3})\s+(.*)$/.exec(t)
    if (h) {
      flushPara()
      closeList()
      const level = h[1].length
      html.push(`<h${level}>${inline(escapeHtml(h[2]), resolve)}</h${level}>`)
      continue
    }
    if (/^[-*]\s+/.test(t)) {
      flushPara()
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${inline(escapeHtml(t.replace(/^[-*]\s+/, '')), resolve)}</li>`)
      continue
    }
    if (t === '') {
      flushPara()
      closeList()
      continue
    }
    closeList()
    para.push(t)
  }
  flushPara()
  closeList()
  return html.join('\n')
}
