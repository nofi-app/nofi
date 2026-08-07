import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  Bold,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
} from 'lucide-react'
import { fileRefUrl } from '../../lib/inline-images'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  insertImage?: (file: File) => Promise<string | null>
  resolveImages?: (container: HTMLElement | null) => void
}

type Mode = 'write' | 'split' | 'preview'

export function MarkdownEditor({
  value,
  onChange,
  insertImage,
  resolveImages,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<Mode>('write')
  const ref = useRef<HTMLTextAreaElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const imgInput = useRef<HTMLInputElement>(null)

  const html = useMemo(() => {
    const rendered = marked.parse(value, { gfm: true, breaks: true }) as string
    return DOMPurify.sanitize(rendered)
  }, [value])

  useEffect(() => {
    const container = document.querySelector('.note-md-preview')
    if (!container) return
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
  }, [value, onChange])

  useEffect(() => {
    if (!resolveImages) return
    const previews = rootRef.current?.querySelectorAll('.note-md-preview')
    previews?.forEach((p) => resolveImages(p as HTMLElement))
  })

  async function insertImageAtCursor(file: File) {
    if (!insertImage) return
    const id = await insertImage(file)
    if (!id) return
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const next =
      value.slice(0, start) +
      `![${file.name}](${fileRefUrl(id)})` +
      value.slice(start)
    onChange(next)
  }

  function onTransfer(e: React.DragEvent | React.ClipboardEvent) {
    const dt =
      'dataTransfer' in e ? e.dataTransfer : e.clipboardData
    if (!dt) return
    const files = Array.from(dt.files).filter((f) =>
      f.type.startsWith('image/'),
    )
    if (!files.length) return
    e.preventDefault()
    for (const file of files) void insertImageAtCursor(file)
  }

  function wrap(open: string, close = open) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const sel = value.slice(start, end)
    const next =
      value.slice(0, start) + open + (sel || 'text') + close + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const p = start + open.length
      el.setSelectionRange(p, p + (sel ? sel.length : 0))
    })
  }

  function linePrefix(prefix: string) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, start + prefix.length)
    })
  }

  function insertLink() {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const sel = value.slice(start, end) || 'link text'
    const url = 'https://'
    const next =
      value.slice(0, start) + `[${sel}](${url})` + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + sel.length + 2, start + sel.length + 2 + url.length)
    })
  }

  function pickImage() {
    imgInput.current?.click()
  }

  function renderToolbar() {
    const btn = (
      onClick: () => void,
      title: string,
      children: React.ReactNode,
    ) => (
      <button
        type="button"
        className="rich-btn"
        onClick={onClick}
        title={title}
      >
        {children}
      </button>
    )
    return (
      <div className="rich-toolbar">
        {btn(() => wrap('**'), 'Bold', <Bold size={15} />)}
        {btn(() => wrap('*'), 'Italic', <Italic size={15} />)}
        {btn(() => wrap('~~'), 'Strikethrough', <Strikethrough size={15} />)}
        {btn(() => wrap('`'), 'Inline code', <Code2 size={15} />)}
        <span className="rich-sep" />
        {btn(() => linePrefix('# '), 'Heading 1', <Heading1 size={15} />)}
        {btn(() => linePrefix('## '), 'Heading 2', <Heading2 size={15} />)}
        {btn(() => linePrefix('### '), 'Heading 3', <Heading3 size={15} />)}
        <span className="rich-sep" />
        {btn(() => linePrefix('- '), 'Bullet list', <List size={15} />)}
        {btn(() => linePrefix('1. '), 'Numbered list', <ListOrdered size={15} />)}
        {btn(() => linePrefix('- [ ] '), 'Checklist', <ListChecks size={15} />)}
        {btn(() => linePrefix('> '), 'Quote', <Quote size={15} />)}
        {btn(() => wrap('```\n', '\n```'), 'Code block', <Code size={15} />)}
        {btn(
          () => linePrefix('---\n'),
          'Horizontal rule',
          <Minus size={15} />,
        )}
        <span className="rich-sep" />
        {btn(insertLink, 'Insert link', <Link2 size={15} />)}
        {btn(pickImage, 'Insert image', <Image size={15} />)}
      </div>
    )
  }
  function renderModeSwitch() {
    return (
      <div className="md-modes">
        <button
          type="button"
          className={`md-mode${mode === 'write' ? ' active' : ''}`}
          onClick={() => setMode('write')}
        >
          Write
        </button>
        <button
          type="button"
          className={`md-mode${mode === 'split' ? ' active' : ''}`}
          onClick={() => setMode('split')}
        >
          Split
        </button>
        <button
          type="button"
          className={`md-mode${mode === 'preview' ? ' active' : ''}`}
          onClick={() => setMode('preview')}
        >
          Preview
        </button>
      </div>
    )
  }

  if (mode === 'preview') {
    return (
      <div ref={rootRef} className="note-md-wrap">
        {renderToolbar()}
        {renderModeSwitch()}
        <div
          className="note-md-preview"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    )
  }

  const textareaProps = {
    className: 'note-editor-text',
    value,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      onChange(e.target.value),
    onDrop: onTransfer,
    onPaste: onTransfer,
    placeholder: 'Write in Markdown…',
  }

  return (
    <div ref={rootRef} className="note-md-wrap">
      {renderToolbar()}
      {renderModeSwitch()}
      <input
        ref={imgInput}
        type="file"
        accept="image/*"
        className="hidden-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void insertImageAtCursor(f)
          e.target.value = ''
        }}
      />
      {mode === 'split' ? (
        <div className="md-split">
          <textarea ref={ref} {...textareaProps} />
          <div
            className="note-md-preview"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      ) : (
        <textarea ref={ref} {...textareaProps} />
      )}
    </div>
  )
}
