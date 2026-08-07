import { useEffect } from 'react'

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['Cmd/Ctrl', 'N'], label: 'New note' },
  { keys: ['Cmd/Ctrl', 'F'], label: 'Search notes' },
  { keys: ['Cmd/Ctrl', 'F'], label: 'Find in note (while editing)' },
  { keys: ['Cmd/Ctrl', 'E'], label: 'Toggle theme' },
  { keys: ['Cmd/Ctrl', 'Shift', 'L'], label: 'Lock vault' },
  { keys: ['?'], label: 'Show this help' },
  { keys: ['Esc'], label: 'Close panel / deselect' },
]

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Keyboard shortcuts</h2>
        {SHORTCUTS.map((s) => (
          <div key={s.label} className="shortcut-row">
            <span>{s.label}</span>
            <span className="kbd">
              {s.keys.map((k) => (
                <span key={k}>{k}</span>
              ))}
            </span>
          </div>
        ))}
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
