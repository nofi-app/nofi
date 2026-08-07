import { useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { fetchSharePayload, parseShareUrl, type SharePayload } from '../lib/share'
import { LockIcon, NotesIcon } from './icons'

const TASK_RE = /^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$/

function RenderChecklist({ text }: { text: string }) {
  const rows = useMemo(() => text.split('\n'), [text])
  return (
    <ul className="shared-checklist">
      {rows.map((line, i) => {
        const m = line.match(TASK_RE)
        if (m) {
          const checked = m[2].toLowerCase() === 'x'
          return (
            <li key={i} className={`check-item${checked ? ' done' : ''}`}>
              <span className="check-box-static">{checked ? '✓' : ''}</span>
              <span>{m[3]}</span>
            </li>
          )
        }
        return line.trim() ? <li key={i}>{line}</li> : null
      })}
    </ul>
  )
}

function fileDataUrl(file: { mimeType: string; data: string }): string {
  return `data:${file.mimeType};base64,${file.data}`
}

function RenderBody({ payload }: { payload: SharePayload }) {
  const fileMap = useMemo(() => {
    const map = new Map<string, { mimeType: string; data: string }>()
    for (const f of payload.files ?? []) map.set(f.id, f)
    return map
  }, [payload.files])

  const html = useMemo(() => {
    let rendered = ''
    if (payload.editor === 'markdown') {
      rendered = marked.parse(payload.text, { gfm: true, breaks: true }) as string
    } else if (payload.editor === 'rich') {
      rendered = payload.text
    } else {
      return ''
    }
    rendered = rendered.replace(/nofi:\/\/file\/([0-9a-f-]+)/g, (_m, id: string) => {
      const f = fileMap.get(id)
      return f ? fileDataUrl(f) : _m
    })
    return DOMPurify.sanitize(rendered)
  }, [payload, fileMap])

  if (payload.editor === 'markdown' || payload.editor === 'rich') {
    return (
      <div
        className="note-md-preview"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
  if (payload.editor === 'checklist') {
    return <RenderChecklist text={payload.text} />
  }
  return <pre className="shared-pre">{payload.text}</pre>
}

export function ShareView() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [payload, setPayload] = useState<SharePayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const url = parseShareUrl()
    if (!url) {
      setStatus('error')
      setError('This link is invalid or missing its decryption key.')
      return
    }
    fetchSharePayload(url.token, url.keyB64)
      .then((p) => {
        if (cancelled) return
        setPayload(p)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Unable to load this note.')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="share-view">
      <header className="share-header">
        <span className="share-brand">
          <NotesIcon size={18} />
          Nofi
        </span>
        <a className="btn share-open" href="/">
          Open Nofi
        </a>
      </header>

      <main className="share-main">
        {status === 'loading' && <p className="share-loading">Loading shared note…</p>}
        {status === 'error' && (
          <div className="share-error">
            <LockIcon size={26} />
            <h2>Can't open this note</h2>
            <p>{error}</p>
            <p className="share-error-hint">
              Shared links only work if the owner hasn't revoked them.
            </p>
          </div>
        )}
        {status === 'ready' && payload && (
          <article className="share-card">
            <h1 className="share-title">{payload.title || 'Untitled note'}</h1>
            <RenderBody payload={payload} />
          </article>
        )}
      </main>
    </div>
  )
}
