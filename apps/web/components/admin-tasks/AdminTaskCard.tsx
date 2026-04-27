'use client'

import { AdminTask, AdminTaskStatus } from '@/types'
import {
  CATEGORY_ICON, CATEGORY_LABEL,
  PRIORITY_LABEL, PRIORITY_COLOR,
  STATUS_LABEL, STATUS_COLOR,
} from '@/lib/adminTasks'

interface Props {
  task: AdminTask
  onStatusChange: (id: string, status: AdminTaskStatus) => void
  onComplete: (task: AdminTask) => void
  onEdit: (task: AdminTask) => void
}

const OPEN_STATUS_OPTIONS: AdminTaskStatus[] = ['PENDIENTE', 'EN_PROGRESO', 'BLOQUEADA']

export function AdminTaskCard({ task, onStatusChange, onComplete, onEdit }: Props) {
  const isClosed = task.status === 'COMPLETADA' || task.status === 'CANCELADA'

  const dueDateLabel = () => {
    if (!task.dueDate) return null
    const d = new Date(task.dueDate)
    const formatted = d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
    if (task.isOverdue) return { label: `Venció el ${formatted}`, cls: 'text-red-500' }
    if (task.isDueSoon) return { label: `Vence el ${formatted} — en ${task.daysUntilDue} día(s)`, cls: 'text-orange-500' }
    return { label: `Vence el ${formatted}`, cls: 'text-slate-400' }
  }

  const due = dueDateLabel()

  return (
    <div className={`bg-white rounded-xl border border-slate-100 p-4 shadow-sm transition-opacity ${isClosed ? 'opacity-60' : ''}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{CATEGORY_ICON[task.category]}</span>
          <span className="text-xs text-slate-400 truncate">{CATEGORY_LABEL[task.category]}</span>
          {task.recurrenceId && (
            <span className="text-xs bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full shrink-0">↻</span>
          )}
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_COLOR[task.priority]}`}>
          {PRIORITY_LABEL[task.priority].toUpperCase()}
        </span>
      </div>

      {/* Title */}
      <p className="font-medium text-slate-800 text-sm mb-1 leading-snug">{task.title}</p>

      {/* Due date */}
      {due && (
        <p className={`text-xs mb-3 ${due.cls}`}>{due.label}</p>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-50">
        {/* Status selector */}
        {!isClosed ? (
          <select
            value={task.status}
            onChange={e => onStatusChange(task.id, e.target.value as AdminTaskStatus)}
            className={`text-xs rounded-full px-2 py-1 border-0 font-medium cursor-pointer focus:ring-0 ${STATUS_COLOR[task.status]}`}
          >
            {OPEN_STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        ) : (
          <span className={`text-xs rounded-full px-2 py-1 font-medium ${STATUS_COLOR[task.status]}`}>
            {STATUS_LABEL[task.status]}
          </span>
        )}

        {/* Actions */}
        {!isClosed && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(task)}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded transition-colors"
            >
              Editar
            </button>
            <button
              onClick={() => onComplete(task)}
              className="text-xs bg-green-50 text-green-600 hover:bg-green-100 px-2 py-1 rounded transition-colors font-medium"
            >
              Completar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
