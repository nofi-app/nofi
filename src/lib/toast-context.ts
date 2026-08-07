import { createContext, useContext } from 'react'

export type ToastType = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

export interface ToastsValue {
  push: (message: string, type?: ToastType) => void
}

export const ToastContext = createContext<ToastsValue | undefined>(undefined)

export function useToasts() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToasts must be used within ToastProvider')
  return ctx
}
