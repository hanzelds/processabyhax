'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

// ── Context ───────────────────────────────────────────────────────────────────

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx.confirm
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface DialogState {
  opts: ConfirmOptions
  resolve: (v: boolean) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const resolveRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve
      setDialog({ opts, resolve })
    })
  }, [])

  function answer(value: boolean) {
    dialog?.resolve(value)
    setDialog(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4"
          onClick={() => answer(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Icon + Title */}
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                ${dialog.opts.danger ? 'bg-red-50' : 'bg-amber-50'}`}>
                <AlertTriangle className={`w-5 h-5 ${dialog.opts.danger ? 'text-red-500' : 'text-amber-500'}`} />
              </div>
              <div>
                {dialog.opts.title && (
                  <p className="font-semibold text-slate-900 text-sm">{dialog.opts.title}</p>
                )}
                <p className="text-sm text-slate-600 mt-0.5 leading-snug">{dialog.opts.message}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => answer(false)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {dialog.opts.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                onClick={() => answer(true)}
                className={`px-4 py-2 text-sm rounded-lg font-medium text-white transition-colors
                  ${dialog.opts.danger
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-[#17394f] hover:bg-[#17394f]/90'
                  }`}
              >
                {dialog.opts.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
