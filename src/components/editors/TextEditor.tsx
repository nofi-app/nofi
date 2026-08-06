interface TextEditorProps {
  value: string
  onChange: (value: string) => void
  monospace?: boolean
}

export function TextEditor({ value, onChange, monospace }: TextEditorProps) {
  return (
    <textarea
      className={`note-editor-text${monospace ? ' monospace' : ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Start writing…"
    />
  )
}
