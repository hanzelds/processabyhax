'use client'

import { useState, useEffect } from 'react'
import { AdminTask, AdminTaskStatus } from '@/types'
import { api } from '@/lib/api'
import {
  CATEGORY_ICON, CATEGORY_LABEL,
  PRIORITY_LABEL, PRIORITY_COLOR,
  STATUS_LABEL, STATUS_COLOR,
} from '@/lib/adminTasks'
import {
  X, Pencil, CheckCircle2, Ban, Clock, Repeat2,
  AlertTriangle, ChevronRight, Loader2,
} from 'lucide-react'

interface HistoryEntry {
  id: string
  eventType: string
  description: string
  createdAt: string
  actor: { id: string; name: string }
}

interface Props {
  task: AdminTask
  onClose: () => void
  onStatusChange: (id: string, status: AdminTaskStatus) => void
  onComplete: (task: AdminTask, notes: string) => void
  onCancel: (task: AdminTask) => void
  onEdit: (task: AdminTask) => void
  onTaskUpdated: (task: AdminTask) => void
}

const OPEN_STATUSES: { status: AdminTaskStatus; label: string }[] = [
  { status: 'PENDIENTE',   label: 'Pendiente'   },
  { status: 'EN_PROGRESO', label: 'En progreso' },
  { status: 'BLOQUEADA',   label: 'Bloqueada'   },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-DO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)  return 'hace un momento'
  if (diff < 3600000) return `hace ${Math.floor(diff / 60000)} min`
  if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)} h`
  return `hace ${Math.floor(diff / 86400000)} d`
}

export function AdminTaskDetailPanel({ task, onClose, onStatusChange, onComplete, onCancel, onEdit, onTaskUpdated }: Props) {
  const [history, setHistory]     = useState<HistoryEntry[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [completeNotes, setCompleteNotes] = useState('')
  const [saving, setSaving]       = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)

  const isClosed = task.status === 'COMPLETADA' || task.status === 'CANCELADA'

  useEffect(() => {
    setHistLoading(true)
    api.get<HistoryEntry[]>(`/api/admin/tasks/${task.id}/history`)
      .then(h => setHistory(h))
      .catch(() => {})
      .finally(() => setHistLoading(false))
  }, [task.id])

  async function handleStatusChange(status: AdminTaskStatus) {
    setStatusChanging(true)
    try { await onStatusChange(task.id, status) }
    finally { setStatusChanging(false) }
  }

  async function handleComplete() {
    setSaving(true)
    try { await onComplete(task, completeNotes) }
    finally { setSaving(false) }
  }

  const dueDateLabel = () => {
    if (!task.dueDate) return null
    const formatted = formatDate(task.dueDate)
    if (task.isOverdue) return { label: `Venció el ${formatted}`, cls: 'text-red-500 bg-red-50', icon: <AlertTriangle className="w-3.5 h-3.5" /> }
    if (task.isDueSoon) return { label: `Vence el ${formatted} — ${task.daysUntilDue} día(s)`, cls: 'text-orange-600 bg-orange-50', icon: <Clock className="w-3.5 h-3.5" /> }
    return { label: `Vence el ${formatted}`, cls: 'text-slate-500 bg-slate-50', icon: <Clock className="w-3.5 h-3.5" /> }
  }

  const due = dueDateLabel()

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9980] bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-[9981] w-full max-w-lg bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-base">{CATEGORY_ICON[task.category]}</span>
              <span className="text-xs text-slate-400">{CATEGORY_LABEL[task.category]}</span>
              {task.recurrenceId && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Repeat2 className="w-3 h-3" /> Recurrente
                </span>
              )}
            </div>
            <h2 className="font-bold text-slate-900 text-base leading-snug">{task.title}</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isClosed && (
              <button
                onClick={() => onEdit(task)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Editar"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Priority + Status row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PRIORITY_COLOR[task.priority]}`}>
              {PRIORITY_LABEL[task.priority].toUpperCase()}
            </span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[task.status]}`}>
              {STATUS_LABEL[task.status]}
            </span>
          </div>

          {/* Due date */}
          {due && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${due.cls}`}>
              {due.icon}
              {due.label}
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Descripción</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Resolution notes (if completed) */}
          {task.resolutionNotes && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-emerald-700 mb-1.5">Notas de resolución</p>
              <p className="text-sm text-emerald-800 leading-relaxed whitespace-pre-wrap">{task.resolutionNotes}</p>
            </div>
          )}

          {/* Status quick-change (open tasks only) */}
          {!isClosed && !showComplete && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Cambiar estado</p>
              <div className="flex flex-wrap gap-2">
                {OPEN_STATUSES.filter(s => s.status !== task.status).map(s => (
                  <button
                    key={s.status}
                    onClick={() => handleStatusChange(s.status)}
                    disabled={statusChanging}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:border-[#17394f]/30 hover:text-[#17394f] hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {statusChanging ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Complete flow */}
          {!isClosed && showComplete && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-emerald-800">¿Completar esta tarea?</p>
              <textarea
                value={completeNotes}
                onChange={e => setCompleteNotes(e.target.value)}
                rows={3}
                placeholder="Notas de resolución (recomendado)…"
                className="w-full border border-emerald-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowComplete(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirmar
                </button>
              </div>
            </div>
          )}

          {/* History */}
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Historial</p>
            {histLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-slate-300">Sin historial</p>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 leading-snug">{h.description}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{h.actor.name} · {timeAgo(h.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-100">
            <p>Creada el {formatDate(task.createdAt)}</p>
            {task.completedAt && <p>Completada el {formatDate(task.completedAt)}</p>}
          </div>
        </div>

        {/* Footer actions */}
        {!isClosed && (
          <div className="px-6 py-4 border-t border-slate-100 flex gap-2 shrink-0 bg-white">
            <button
              onClick={() => onCancel(task)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
            >
              <Ban className="w-3.5 h-3.5" />
              Cancelar tarea
            </button>
            <button
              onClick={() => { setShowComplete(true); setCompleteNotes('') }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Marcar completada
            </button>
          </div>
        )}
      </div>
    </>
  )
}
