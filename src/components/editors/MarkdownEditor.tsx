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
import {
  detectLinkSuggest,
  filterSuggestions,
  NOTE_LINK_RE,
  type NoteLinkSuggest,
} from '../../lib/note-links'
import { NoteLinkPopup } from '../NoteLinkPopup'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  insertImage?: (file: File) => Promise<string | null>
  resolveImages?: (container: HTMLElement | null) => void
  notes?: { id: string; title: string }[]
  excludeId?: string
  onOpenNote?: (id: string) => void
}

type Mode = 'write' | 'split' | 'preview'

export function MarkdownEditor({
  value,
  onChange,
  insertImage,
  resolveImages,
  notes,
  excludeId,
  onOpenNote,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<Mode>('write')
  const ref = useRef<HTMLTextAreaElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const imgInput = useRef<HTMLInputElement>(null)
  const [suggest, setSuggest] = useState<NoteLinkSuggest>({
    open: false,
    query: '',
  })
  const [suggestIndex, setSuggestIndex] = useState(0)

  const displayValue = useMemo(
    () =>
      value.replace(
        NOTE_LINK_RE,
        (_m, title: string) => `[${title}](#note-link)`,
      ),
    [value],
  )

  const html = useMemo(() => {
    const rendered = marked.parse(displayValue, { gfm: true, breaks: true }) as string
    return DOMPurify.sanitize(rendered)
  }, [displayValue])

  const options = useMemo(
    () => filterSuggestions(notes ?? [], suggest.query, excludeId ?? ''),
    [notes, suggest.query, excludeId],
  )

  useEffect(() => {
    const container = document.querySelector('.note-md-preview')
    if (!container) return
    const toggle = (e: Event) => {
      const link = (e.target as HTMLElement).closest('a[href="#note-link"]')
      if (link) {
        if (onOpenNote && notes) {
          const title = link.textContent ?? ''
          const match = notes.find((r) => r.title === title)
          if (match) onOpenNote(match.id)
        }
        return
      }
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
  }, [value, onChange, onOpenNote, notes])

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

  function updateSuggest() {
    const el = ref.current
    if (!el) return
    const pos = el.selectionStart
    const det = detectLinkSuggest(value.slice(0, pos), value.slice(pos))
    if (det.open) {
      setSuggest({ open: true, query: det.query })
      setSuggestIndex(0)
    } else {
      setSuggest((s) => (s.open ? { open: false, query: '' } : s))
    }
  }

  function pickSuggestion(opt: { id: string; title: string }) {
    const el = ref.current
    if (!el) return
    const pos = el.selectionStart
    const before = value.slice(0, pos)
    const start = before.lastIndexOf('[[')
    if (start === -1) return
    const next =
      value.slice(0, start) + `[[${opt.title}]]` + value.slice(pos)
    onChange(next)
    setSuggest({ open: false, query: '' })
    requestAnimationFrame(() => {
      el.focus()
      const caret = start + opt.title.length + 4
      el.setSelectionRange(caret, caret)
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!suggest.open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggestIndex((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggestIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const opt = options[suggestIndex]
      if (opt) pickSuggestion(opt)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setSuggest({ open: false, query: '' })
    }
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
    onKeyUp: updateSuggest,
    onKeyDown,
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
      <NoteLinkPopup
        open={suggest.open}
        options={options}
        index={suggestIndex}
        onPick={pickSuggestion}
        style={{ top: '48px' }}
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
