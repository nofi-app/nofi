import { useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const [preview, setPreview] = useState(false)

  const html = useMemo(() => {
    const rendered = marked.parse(value, { gfm: true, breaks: true }) as string
    return DOMPurify.sanitize(rendered)
  }, [value])

  useEffect(() => {
    const container = document.querySelector('.note-md-preview')
    if (!container || !preview) return
    const toggle = (e: Event) => {
      const box = (e.target as HTMLElement).closest('input[type="checkbox"]')
      if (!box) return
      const line = (box as HTMLElement).closest('li')
      if (!line) return
      const index = Array.from(line.parentElement?.children ?? []).indexOf(line)
      const lines = value.split('\n')
      let seen = 0
      const out = lines.map((l) => {
        if (!/^\s*[-*+]\s+\[[ x]\]/.test(l)) return l
        const isChecked = seen === index
        seen++
        return isChecked
          ? l.replace(/\[[ x]\]/, '[x]')
          : l.replace(/\[[ x]\]/, '[ ]')
      })
      onChange(out.join('\n'))
    }
    container.addEventListener('click', toggle)
    return () => container.removeEventListener('click', toggle)
  }, [preview, value, onChange])

  if (preview) {
    return (
      <div className="note-md-preview" dangerouslySetInnerHTML={{ __html: html }} />
    )
  }

  return (
    <div className="note-md-wrap">
      <textarea
        className="note-editor-text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write in Markdown…"
      />
      <button
        type="button"
        className="editor-toggle"
        onClick={() => setPreview(true)}
      >
        Preview
      </button>
    </div>
  )
}
