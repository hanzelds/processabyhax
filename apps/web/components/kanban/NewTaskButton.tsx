'use client'

import { useState } from 'react'
import { Task, TaskType, User } from '@/types'
import { TASK_TYPE_OPTIONS } from '@/lib/utils'
import { api } from '@/lib/api'
import { AssigneePicker } from '@/components/tasks/AssigneePicker'
import { Plus } from 'lucide-react'

interface Props {
  projectId: string
  status: import('@/types').TaskStatus
  users: User[]
  onCreated: (task: Task) => void
}

const INPUT_CLS = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/30 focus:border-[#17394f]/50 transition-colors'

export function NewTaskButton({ projectId, status, users, onCreated }: Props) {
  const [open, setOpen]               = useState(false)
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [dueDate, setDueDate]         = useState('')
  const [taskType, setTaskType]       = useState<TaskType | ''>('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  function reset() {
    setTitle(''); setDescription(''); setAssigneeIds([])
    setDueDate(''); setTaskType(''); setError('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true); setError('')
    try {
      const task = await api.post<Task>('/api/tasks', {
        title:       title.trim(),
        description: description.trim() || undefined,
        projectId,
        status,
        assignees:   assigneeIds.length > 0 ? assigneeIds : undefined,
        dueDate:     dueDate || undefined,
        taskType:    taskType || undefined,
      })
      onCreated(task)
      reset()
      setOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-6 h-6 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md flex items-center justify-center transition-colors"
        title="Nueva tarea"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => { setOpen(false); reset() }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 sm:p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Nueva tarea</h3>
              <button onClick={() => { setOpen(false); reset() }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              {/* Título */}
              <input
                autoFocus
                required
                placeholder="Título de la tarea"
                className={INPUT_CLS}
                value={title}
                onChange={e => setTitle(e.target.value)}
              />

              {/* Tipo */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Tipo de trabajo</label>
                <select
                  className={INPUT_CLS}
                  value={taskType}
                  onChange={e => setTaskType(e.target.value as TaskType | '')}
                >
                  <option value="">Sin clasificar</option>
                  {TASK_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <textarea
                placeholder="Descripción (opcional)"
                rows={2}
                className={`${INPUT_CLS} resize-none`}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />

              {/* Asignar */}
              {users.length > 0 && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Equipo</label>
                  <AssigneePicker
                    users={users}
                    selectedIds={assigneeIds}
                    onChange={setAssigneeIds}
                  />
                </div>
              )}

              {/* Fecha */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Fecha límite</label>
                <input
                  type="date"
                  className={INPUT_CLS}
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="w-full bg-[#17394f] hover:bg-[#17394f]/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2.5 transition-colors mt-1"
              >
                {saving ? 'Creando…' : 'Crear tarea'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
