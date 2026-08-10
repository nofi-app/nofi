import { useCallback, useState, type ReactNode } from 'react'
import { ToastContext, type Toast } from '../lib/toast-context'
import { AlertIcon, CheckIcon, SparkIcon, XIcon } from './icons'

let nextId = 1

const TOAST_ICON: Record<Toast['type'], ReactNode> = {
  info: <SparkIcon size={14} />,
  success: <CheckIcon size={14} />,
  error: <AlertIcon size={14} />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback(
    (message: string, type: Toast['type'] = 'info') => {
      const id = nextId++
      setToasts((t) => [...t, { id, message, type }])
      window.setTimeout(() => dismiss(id), 3500)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {TOAST_ICON[t.type]}
            <span>{t.message}</span>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <XIcon size={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
