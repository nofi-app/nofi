export function EditorSkeleton() {
  return (
    <div className="editor-skeleton" aria-hidden="true">
      <div className="sk-title" />
      <div className="sk-toolbar">
        <div className="sk-chip" />
        <div className="sk-chip" />
        <div className="sk-chip" />
        <div className="sk-chip" />
        <div className="sk-chip" />
      </div>
      <div className="sk-body">
        <div className="sk-line w-90" />
        <div className="sk-line w-70" />
        <div className="sk-line w-80" />
        <div className="sk-line w-50" />
        <div className="sk-line w-85" />
        <div className="sk-line w-60" />
        <div className="sk-line w-75" />
      </div>
    </div>
  )
}

export function ListSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="list-skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="list-skeleton-item" key={i}>
          <div className="sk-line w-60" />
          <div className="sk-line w-30 thin" />
        </div>
      ))}
    </div>
  )
}
