'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Task, TaskStatus, TaskType, User } from '@/types'
import {
  formatDate, isOverdue,
  TASK_STATUS_LABEL, TASK_STATUS_COLOR,
  TASK_TYPE_LABEL, TASK_TYPE_COLOR, TASK_TYPE_OPTIONS,
} from '@/lib/utils'
import { api } from '@/lib/api'

const ALL_STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'BLOCKED']

const INPUT_CLS = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/30 focus:border-[#17394f]/50 transition-colors'

interface Props {
  task: Task
  isDragging?: boolean
  onUpdate?: (task: Task) => void
  isAdmin?: boolean
  users?: User[]
}

export function KanbanCard({ task, isDragging, onUpdate, isAdmin, users = [] }: Props) {
  const [open, setOpen]           = useState(false)
  const [editing, setEditing]     = useState(false)
  const [title, setTitle]         = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [assignedTo, setAssignedTo]   = useState(task.assignedTo || '')
  const [dueDate, setDueDate]     = useState(task.dueDate ? task.dueDate.split('T')[0] : '')
  const [status, setStatus]       = useState(task.status)
  const [taskType, setTaskType]   = useState<TaskType | ''>(task.taskType || '')
  const [saving, setSaving]       = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isSortDragging ? 0.4 : 1 }
  const overdue = isOverdue(task.dueDate, task.status)

  async function saveEdit() {
    setSaving(true)
    try {
      const updated = await api.patch<Task>(`/api/tasks/${task.id}`, {
        title, description, status,
        taskType: taskType || null,
        assignedTo: assignedTo || null,
        dueDate: dueDate || null,
      })
      onUpdate?.(updated)
      setEditing(false)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  function closeModal() { setOpen(false); setEditing(false) }

  if (isDragging) {
    return (
      <div className="bg-white border border-[#17394f]/30 rounded-xl px-3 py-2.5 shadow-lg opacity-90 rotate-1 cursor-grabbing">
        <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
      </div>
    )
  }

  const typeLabel = task.taskType ? TASK_TYPE_LABEL[task.taskType] : null
  const typeColor = task.taskType ? TASK_TYPE_COLOR[task.taskType] : null

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`bg-white rounded-xl border px-3 py-2.5 cursor-grab active:cursor-grabbing select-none hover:shadow-sm transition-shadow ${
          overdue ? 'border-red-200' : 'border-slate-200'
        }`}
        {...attributes}
        {...listeners}
        onClick={() => setOpen(true)}
      >
        {/* Type badge */}
        {typeLabel && (
          <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mb-1.5 ${typeColor}`}>
            {typeLabel}
          </span>
        )}

        <p className="text-sm font-medium text-slate-800 leading-snug mb-1.5">{task.title}</p>

        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TASK_STATUS_COLOR[task.status]}`}>
            {TASK_STATUS_LABEL[task.status]}
          </span>
          <div className="flex items-center gap-2">
            {task.assignee && (
              <span className="text-xs text-slate-400 truncate max-w-20">{task.assignee.name.split(' ')[0]}</span>
            )}
            {task.dueDate && (
              <span className={`text-xs tabular-nums ${overdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                {formatDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Detail / Edit modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6"
            onClick={e => e.stopPropagation()}
          >
            {editing ? (
              <div className="space-y-3">
                <input
                  className={`${INPUT_CLS} font-medium`}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
                <textarea
                  className={`${INPUT_CLS} resize-none`}
                  rows={3}
                  placeholder="Descripción…"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />

                {/* Tipo */}
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Tipo de trabajo</label>
                  <select className={INPUT_CLS} value={taskType} onChange={e => setTaskType(e.target.value as TaskType | '')}>
                    <option value="">Sin clasificar</option>
                    {TASK_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Estado</label>
                    <select className={INPUT_CLS} value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>
                      {ALL_STATUSES.map(s => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Fecha límite</label>
                    <input
                      type="date"
                      className={INPUT_CLS}
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                    />
                  </div>
                </div>

                {isAdmin && users.length > 0 && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Asignado a</label>
                    <select className={INPUT_CLS} value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                      <option value="">Sin asignar</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}{u.area ? ` · ${u.area}` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="flex-1 bg-[#17394f] hover:bg-[#17394f]/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
                  >
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 border border-slate-200 text-slate-600 text-sm rounded-lg py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    {typeLabel && (
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 ${typeColor}`}>
                        {typeLabel}
                      </span>
                    )}
                    <h3 className="font-semibold text-slate-900">{task.title}</h3>
                  </div>
                  <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl leading-none shrink-0">×</button>
                </div>

                {task.description && (
                  <p className="text-slate-500 text-sm mb-4 leading-relaxed">{task.description}</p>
                )}

                <div className="space-y-2.5 text-sm mb-5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Estado</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TASK_STATUS_COLOR[task.status]}`}>
                      {TASK_STATUS_LABEL[task.status]}
                    </span>
                  </div>
                  {task.assignee && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Asignado</span>
                      <span className="text-slate-700">{task.assignee.name}</span>
                    </div>
                  )}
                  {task.dueDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Fecha límite</span>
                      <span className={`tabular-nums ${overdue ? 'text-red-500 font-medium' : 'text-slate-700'}`}>
                        {formatDate(task.dueDate)}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setEditing(true)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
                >
                  Editar tarea
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
