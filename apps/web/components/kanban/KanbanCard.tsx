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
import { AssigneePicker } from '@/components/tasks/AssigneePicker'
import { LockOpen, Trash2, Loader2, AlertTriangle } from 'lucide-react'

const ALL_STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'BLOCKED']

const INPUT_CLS = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/30 focus:border-[#17394f]/50 transition-colors'

interface Props {
  task: Task
  isDragging?: boolean
  onUpdate?: (task: Task) => void
  onDelete?: (id: string) => void
  isAdmin?: boolean
  users?: User[]
}

export function KanbanCard({ task, isDragging, onUpdate, onDelete, isAdmin, users = [] }: Props) {
  const [open, setOpen]               = useState(false)
  const [editing, setEditing]         = useState(false)
  const [reopening, setReopening]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [title, setTitle]             = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assignees.map(a => a.id))
  const [dueDate, setDueDate]         = useState(task.dueDate ? task.dueDate.split('T')[0] : '')
  const [status, setStatus]           = useState(task.status)
  const [taskType, setTaskType]       = useState<TaskType | ''>(task.taskType || '')
  const [saving, setSaving]           = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isSortDragging ? 0.4 : 1 }
  const overdue = isOverdue(task.dueDate, task.status)

  async function saveEdit() {
    setSaving(true)
    try {
      const updated = await api.patch<Task>(`/api/tasks/${task.id}`, {
        title, description, status,
        taskType: taskType || null,
        assignees: assigneeIds,
        dueDate: dueDate || null,
      })
      onUpdate?.(updated)
      setEditing(false)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  function closeModal() { setOpen(false); setEditing(false); setConfirmDelete(false) }

  async function reopen() {
    setReopening(true)
    try {
      const updated = await api.patch<Task>(`/api/tasks/${task.id}/reopen`, {})
      onUpdate?.(updated)
    } finally { setReopening(false) }
  }

  async function deleteTask() {
    setDeleting(true)
    try {
      await api.delete(`/api/tasks/${task.id}`)
      onDelete?.(task.id)
      closeModal()
    } catch { setDeleting(false) }
  }

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
        {/* Type badge + Brief badge */}
        <div className="flex items-center gap-1 flex-wrap mb-1.5">
          {typeLabel && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${typeColor}`}>
              {typeLabel}
            </span>
          )}
          {task.briefId && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">
              📄 Brief
            </span>
          )}
        </div>

        <p className="text-sm font-medium text-slate-800 leading-snug mb-1.5">{task.title}</p>

        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TASK_STATUS_COLOR[task.status]}`}>
            {TASK_STATUS_LABEL[task.status]}
          </span>
          <div className="flex items-center gap-2">
            {task.assignees.length > 0 && (
              <span className="text-xs text-slate-400 truncate max-w-24">
                {task.assignees.length === 1
                  ? task.assignees[0].name.split(' ')[0]
                  : `${task.assignees[0].name.split(' ')[0]} +${task.assignees.length - 1}`}
              </span>
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
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 overflow-hidden"
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
                    <label className="text-xs text-slate-500 mb-1 block">Equipo asignado</label>
                    <AssigneePicker
                      users={users}
                      selectedIds={assigneeIds}
                      onChange={setAssigneeIds}
                    />
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
                    <div className="flex items-center gap-1 flex-wrap mb-2">
                      {typeLabel && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>
                          {typeLabel}
                        </span>
                      )}
                      {task.briefId && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">
                          📄 Brief vinculado
                        </span>
                      )}
                    </div>
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
                  {task.assignees.length > 0 && (
                    <div className="flex justify-between items-start">
                      <span className="text-slate-400 shrink-0">
                        {task.assignees.length === 1 ? 'Asignado' : 'Equipo'}
                      </span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {task.assignees.map(a => (
                          <span key={a.id} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                            {a.name.split(' ')[0]}
                          </span>
                        ))}
                      </div>
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

                {isAdmin && (
                  <div className="flex gap-2 mt-2">
                    {task.status === 'COMPLETED' && (
                      <button
                        onClick={reopen}
                        disabled={reopening}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                      >
                        {reopening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LockOpen className="w-3.5 h-3.5" />}
                        {reopening ? 'Reabriendo…' : 'Reabrir'}
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Delete confirmation overlay */}
            {confirmDelete && (
              <div className="absolute inset-0 bg-white rounded-2xl p-6 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Eliminar tarea</p>
                    <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-6 flex-1">
                  ¿Eliminar <strong>"{task.title}"</strong> permanentemente?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={deleteTask}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {deleting ? 'Eliminando…' : 'Sí, eliminar'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
