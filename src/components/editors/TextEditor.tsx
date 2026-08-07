import { useRef } from 'react'
import { FindBar } from '../FindBar'

interface TextEditorProps {
  value: string
  onChange: (value: string) => void
  monospace?: boolean
  findOpen?: boolean
  onFindClose?: () => void
}

export function TextEditor({
  value,
  onChange,
  monospace,
  findOpen,
  onFindClose,
}: TextEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  return (
    <div className="note-text-wrap">
      {findOpen && onFindClose && (
        <FindBar value={value} textareaRef={ref} onClose={onFindClose} />
      )}
      <textarea
        ref={ref}
        className={`note-editor-text${monospace ? ' monospace' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Start writing…"
      />
    </div>
  )
}
