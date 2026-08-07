import { StickyNote } from 'lucide-react'

interface NoteLinkPopupProps {
  open: boolean
  options: { id: string; title: string }[]
  index: number
  onPick: (option: { id: string; title: string }) => void
  style?: React.CSSProperties
}

export function NoteLinkPopup({
  open,
  options,
  index,
  onPick,
  style,
}: NoteLinkPopupProps) {
  if (!open || options.length === 0) return null
  return (
    <div className="note-link-popup" style={style}>
      {options.map((opt, i) => (
        <button
          key={opt.id}
          type="button"
          className={`note-link-option${i === index ? ' active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault()
            onPick(opt)
          }}
        >
          <StickyNote size={14} />
          <span>{opt.title}</span>
        </button>
      ))}
    </div>
  )
}
