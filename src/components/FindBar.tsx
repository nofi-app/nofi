import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { Node } from '@tiptap/pm/model'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'

interface FindBarProps {
  value: string
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  editor?: Editor | null
  onMatch?: (from: number, to: number, index: number) => void
  onClose: () => void
}

function findMatches(text: string, query: string): [number, number][] {
  const q = query.toLowerCase()
  const out: [number, number][] = []
  if (!q) return out
  const t = text.toLowerCase()
  let i = t.indexOf(q)
  while (i !== -1) {
    out.push([i, i + q.length])
    i = t.indexOf(q, i + q.length)
  }
  return out
}

function textOffsetToPos(doc: Node, target: number): number {
  let acc = 0
  let result = doc.content.size
  doc.descendants((node, pos) => {
    if (result !== doc.content.size) return false
    if (node.isText) {
      const text = node.text ?? ''
      if (acc <= target && target <= acc + text.length) {
        result = pos + (target - acc)
      }
      acc += text.length
    }
    return true
  })
  return result
}

export function FindBar({ value, textareaRef, editor, onMatch, onClose }: FindBarProps) {
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const matches = useMemo(() => findMatches(value, query), [value, query])
  const count = matches.length

  const applyRef = useRef<(idx: number) => void>(() => {})
  applyRef.current = (idx: number) => {
    const m = matches[idx]
    if (!m) return
    if (onMatch) {
      onMatch(m[0], m[1], idx)
      return
    }
    const el = textareaRef?.current
    if (el) {
      el.setSelectionRange(m[0], m[1])
      el.focus()
      const before = value.slice(0, m[0])
      const lineIdx = before.split('\n').length - 1
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 20
      el.scrollTop = Math.max(0, lineIdx * lh - el.clientHeight / 2)
      return
    }
    if (editor) {
      const doc = editor.state.doc
      const from = textOffsetToPos(doc, m[0])
      const to = textOffsetToPos(doc, m[1])
      editor.chain().focus().setTextSelection({ from, to }).run()
      editor.commands.scrollIntoView()
    }
  }

  useEffect(() => {
    setCurrent(0)
    if (query && matches.length) applyRef.current(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const go = (delta: number) => {
    if (!count) return
    const next = (current + delta + count) % count
    setCurrent(next)
    applyRef.current(next)
  }

  return (
    <div className="find-bar">
      <Search size={13} />
      <input
        ref={inputRef}
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            go(e.shiftKey ? -1 : 1)
          } else if (e.key === 'Escape') {
            onClose()
          }
        }}
        placeholder="Find in note"
      />
      <span className="find-count">{count ? `${current + 1}/${count}` : '0/0'}</span>
      <button
        type="button"
        className="find-btn"
        onClick={() => go(-1)}
        title="Previous (Shift+Enter)"
      >
        <ChevronUp size={13} />
      </button>
      <button
        type="button"
        className="find-btn"
        onClick={() => go(1)}
        title="Next (Enter)"
      >
        <ChevronDown size={13} />
      </button>
      <button type="button" className="find-btn" onClick={onClose} title="Close (Esc)">
        <X size={13} />
      </button>
    </div>
  )
}
