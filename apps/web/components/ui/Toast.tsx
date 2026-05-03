'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  success: (msg: string) => void
  error:   (msg: string) => void
  info:    (msg: string) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((type: ToastType, message: string) => {
    const id = nextId++
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => dismiss(id), 4500)
  }, [dismiss])

  const value: ToastContextValue = {
    success: (msg) => push('success', msg),
    error:   (msg) => push('error',   msg),
    info:    (msg) => push('info',    msg),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container — top-right, above everything */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map(t => (
          <ToastBubble key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ── Individual toast bubble ───────────────────────────────────────────────────

const CONFIG: Record<ToastType, { icon: ReactNode; bg: string; border: string; text: string }> = {
  success: {
    icon:   <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />,
    bg:     'bg-white',
    border: 'border-emerald-200',
    text:   'text-slate-800',
  },
  error: {
    icon:   <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
    bg:     'bg-white',
    border: 'border-red-200',
    text:   'text-slate-800',
  },
  info: {
    icon:   <Info className="w-4 h-4 text-[#17394f] shrink-0 mt-0.5" />,
    bg:     'bg-white',
    border: 'border-slate-200',
    text:   'text-slate-800',
  },
}

function ToastBubble({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const c = CONFIG[toast.type]
  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full
        ${c.bg} ${c.border} ${c.text} animate-in slide-in-from-right-4 fade-in duration-200`}
    >
      {c.icon}
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 mt-0.5"
        aria-label="Cerrar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
