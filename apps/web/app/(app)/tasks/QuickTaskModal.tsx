'use client'

import { useState } from 'react'
import { Task, User, TaskType } from '@/types'
import { TASK_TYPE_OPTIONS } from '@/lib/utils'
import { api } from '@/lib/api'
import { X } from 'lucide-react'

interface Props {
  users: User[]
  isAdmin: boolean
  currentUserId: string
  onCreated: (task: Task) => void
  onClose: () => void
}

const INPUT = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/30 focus:border-[#17394f]/50 transition-colors bg-white'

export function QuickTaskModal({ users, isAdmin, currentUserId, onCreated, onClose }: Props) {
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [taskType, setTaskType]     = useState<TaskType | ''>('')
  const [assigneeId, setAssigneeId] = useState(currentUserId)
  const [dueDate, setDueDate]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError('')
    try {
      const task = await api.post<Task>('/api/tasks', {
        title: title.trim(),
        ...(description && { description }),
        ...(taskType && { taskType }),
        ...(assigneeId && { assignees: [assigneeId] }),
        ...(dueDate && { dueDate }),
        // No projectId — standalone task
      })
      onCreated(task)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear tarea')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Nueva tarea personal</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Título */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Título *</label>
            <input
              autoFocus
              required
              placeholder="¿Qué hay que hacer?"
              className={INPUT}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Descripción</label>
            <textarea
              rows={2}
              placeholder="Detalles opcionales..."
              className={`${INPUT} resize-none`}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Tipo + Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Tipo</label>
              <select className={INPUT} value={taskType} onChange={e => setTaskType(e.target.value as TaskType | '')}>
                <option value="">Sin tipo</option>
                {TASK_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Fecha límite</label>
              <input
                type="date"
                className={INPUT}
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Asignar a (admin only para asignar a otros) */}
          {isAdmin && users.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Asignar a</label>
              <select className={INPUT} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">Sin asignar</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}{u.id === currentUserId ? ' (yo)' : ''}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg py-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 bg-[#17394f] hover:bg-[#17394f]/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors"
            >
              {saving ? 'Creando...' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
