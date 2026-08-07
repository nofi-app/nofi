import { useRef } from 'react'
import { Check, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { FindBar } from '../FindBar'

interface ChecklistEditorProps {
  value: string
  onChange: (value: string) => void
  findOpen?: boolean
  onFindClose?: () => void
}

const TASK_RE = /^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$/

export function ChecklistEditor({ value, onChange, findOpen, onFindClose }: ChecklistEditorProps) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([])

  const lines = value.split('\n')

  function applyFind(from: number, to: number) {
    const before = value.slice(0, from)
    const lineIdx = before.split('\n').length - 1
    const lineStart = before.lastIndexOf('\n') + 1
    const el = refs.current[lineIdx]
    if (!el) return
    el.setSelectionRange(from - lineStart, to - lineStart)
    el.focus()
  }

  function setLine(i: number, next: string) {
    const copy = lines.slice()
    copy[i] = next
    onChange(copy.join('\n'))
  }

  function toggle(i: number) {
    const m = lines[i]?.match(TASK_RE)
    if (!m) return
    const [, indent, mark, rest] = m
    setLine(
      i,
      `${indent}- [${mark.toLowerCase() === 'x' ? ' ' : 'x'}] ${rest}`,
    )
  }

  function addAfter(i: number) {
    const copy = lines.slice()
    copy.splice(i + 1, 0, '- [ ] ')
    onChange(copy.join('\n'))
    requestAnimationFrame(() => refs.current[i + 1]?.focus())
  }

  function append() {
    const next = lines.length ? `${lines.join('\n')}\n` : ''
    onChange(`${next}- [ ] `)
    requestAnimationFrame(() => {
      const last = refs.current[lines.length]
      last?.focus()
      last?.setSelectionRange(7, 7)
    })
  }

  function remove(i: number) {
    if (lines.length <= 1) {
      onChange('')
      return
    }
    const copy = lines.slice()
    copy.splice(i, 1)
    onChange(copy.join('\n'))
  }

  function move(i: number, delta: number) {
    const j = i + delta
    if (j < 0 || j >= lines.length) return
    const copy = lines.slice()
    const [line] = copy.splice(i, 1)
    copy.splice(j, 0, line)
    onChange(copy.join('\n'))
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    const m = lines[i]?.match(TASK_RE)
    if (e.key === 'Enter') {
      e.preventDefault()
      addAfter(i)
      return
    }
    const isEmptyTask = m && m[3] === ''
    const isEmptyPlain = !m && lines[i].trim() === ''
    if (e.key === 'Backspace' && (isEmptyTask || isEmptyPlain)) {
      e.preventDefault()
      remove(i)
    }
  }

  function renderRow(i: number) {
    const line = lines[i]
    const m = line.match(TASK_RE)
    const ref = (el: HTMLTextAreaElement | null) => {
      refs.current[i] = el
    }
    if (m) {
      const [, , mark, rest] = m
      const checked = mark.toLowerCase() === 'x'
      return (
        <li className={`check-item${checked ? ' done' : ''}`} key={i}>
          <button
            type="button"
            className="check-box"
            onClick={() => toggle(i)}
            aria-label={checked ? 'Mark as not done' : 'Mark as done'}
          >
            {checked && <Check size={13} />}
          </button>
          <textarea
            ref={ref}
            className="check-text"
            value={rest}
            placeholder="Task…"
            onChange={(e) => setLine(i, `${m[1]}- [${mark}] ${e.target.value}`)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            rows={1}
          />
          <span className="check-moves">
            <button
              type="button"
              className="check-move"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              title="Move up"
            >
              <ChevronUp size={13} />
            </button>
            <button
              type="button"
              className="check-move"
              onClick={() => move(i, 1)}
              disabled={i === lines.length - 1}
              title="Move down"
            >
              <ChevronDown size={13} />
            </button>
          </span>
        </li>
      )
    }
    return (
      <li className="check-item plain" key={i}>
        <span className="check-bullet">•</span>
        <textarea
          ref={ref}
          className="check-text"
          value={line}
          placeholder="Note…"
          onChange={(e) => setLine(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          rows={1}
        />
      </li>
    )
  }

  return (
    <div className="checklist">
      {findOpen && onFindClose && (
        <FindBar value={value} onMatch={applyFind} onClose={onFindClose} />
      )}
      <ul className="check-list">{lines.map((_, i) => renderRow(i))}</ul>
      <button type="button" className="check-add" onClick={append}>
        <Plus size={13} />
        Add item
      </button>
      <p className="check-hint">
        Press Enter to add an item, Backspace on an empty item to remove it.
      </p>
    </div>
  )
}
