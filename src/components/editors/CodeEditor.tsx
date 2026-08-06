import CodeMirror from '@uiw/react-codemirror'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  return (
    <div className="note-code-wrap">
      <CodeMirror
        value={value}
        height="100%"
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: false }}
      />
    </div>
  )
}
