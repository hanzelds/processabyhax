'use client'

import { AdminTask, AdminTaskStatus } from '@/types'
import {
  CATEGORY_ICON, CATEGORY_LABEL,
  PRIORITY_LABEL, PRIORITY_COLOR,
} from '@/lib/adminTasks'
import { AlertTriangle, Clock, Repeat2 } from 'lucide-react'

interface Props {
  task: AdminTask
  onClick: () => void
  onStatusChange: (id: string, status: AdminTaskStatus) => void
}

const PRIORITY_LEFT_BORDER: Record<string, string> = {
  URGENTE: 'border-l-red-500',
  ALTA:    'border-l-orange-400',
  NORMAL:  'border-l-slate-200',
  BAJA:    'border-l-slate-100',
}

const NEXT_STATUS: Partial<Record<AdminTaskStatus, { status: AdminTaskStatus; label: string; cls: string }>> = {
  PENDIENTE:   { status: 'EN_PROGRESO', label: 'Iniciar',  cls: 'text-blue-600 hover:bg-blue-50 border-blue-200' },
  EN_PROGRESO: { status: 'PENDIENTE',   label: 'Pausar',   cls: 'text-slate-500 hover:bg-slate-50 border-slate-200' },
  BLOQUEADA:   { status: 'EN_PROGRESO', label: 'Retomar',  cls: 'text-blue-600 hover:bg-blue-50 border-blue-200' },
}

function dueDateInfo(task: AdminTask) {
  if (!task.dueDate) return null
  const d = new Date(task.dueDate)
  const label = d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
  if (task.isOverdue) return { label: `Venció ${label}`, cls: 'text-red-500', icon: true }
  if (task.isDueSoon) return { label: `${label} · ${task.daysUntilDue}d`, cls: 'text-orange-500', icon: false }
  return { label, cls: 'text-slate-400', icon: false }
}

export function AdminTaskCard({ task, onClick, onStatusChange }: Props) {
  const due  = dueDateInfo(task)
  const next = NEXT_STATUS[task.status]

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-100 border-l-4 ${PRIORITY_LEFT_BORDER[task.priority]} shadow-sm hover:shadow-md hover:border-slate-200 transition-all cursor-pointer group`}
    >
      <div className="px-4 pt-3.5 pb-3">
        {/* Top row: category + priority */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm shrink-0">{CATEGORY_ICON[task.category]}</span>
            <span className="text-xs text-slate-400 truncate">{CATEGORY_LABEL[task.category]}</span>
            {task.recurrenceId && (
              <span title="Recurrente"><Repeat2 className="w-3 h-3 text-slate-300 shrink-0" /></span>
            )}
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 tracking-wide ${PRIORITY_COLOR[task.priority]}`}>
            {PRIORITY_LABEL[task.priority].toUpperCase()}
          </span>
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-slate-800 leading-snug mb-1 group-hover:text-[#17394f] transition-colors">
          {task.title}
        </p>

        {/* Description preview */}
        {task.description && (
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-2">
            {task.description}
          </p>
        )}

        {/* Due date */}
        {due && (
          <div className={`flex items-center gap-1 text-xs ${due.cls} mb-2`}>
            {due.icon ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {due.label}
          </div>
        )}

        {/* Action row */}
        {next && (
          <div
            className="pt-2 border-t border-slate-50 flex items-center justify-end"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => onStatusChange(task.id, next.status)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${next.cls}`}
            >
              {next.label}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
