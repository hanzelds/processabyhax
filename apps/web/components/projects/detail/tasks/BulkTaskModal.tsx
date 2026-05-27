'use client'

import { useState } from 'react'
import { Task, TaskType, User } from '@/types'
import { TASK_TYPE_OPTIONS } from '@/lib/utils'
import { api } from '@/lib/api'
import { Plus, Trash2, Layers } from 'lucide-react'

interface TaskRow {
  _id: string
  title: string
  taskType: TaskType | ''
  assigneeId: string
  dueDate: string
}

interface Props {
  projectId: string
  users: User[]
  onCreated: (tasks: Task[]) => void
  onClose: () => void
}

function newRow(): TaskRow {
  return { _id: Math.random().toString(36).slice(2), title: '', taskType: '', assigneeId: '', dueDate: '' }
}

const INPUT = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/30 focus:border-[#17394f]/50 transition-colors bg-white'

export function BulkTaskModal({ projectId, users, onCreated, onClose }: Props) {
  const [rows, setRows] = useState<TaskRow[]>([newRow(), newRow(), newRow()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateRow(id: string, field: keyof TaskRow, value: string) {
    setRows(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setRows(prev => [...prev, newRow()])
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r._id !== id))
  }

  const validRows = rows.filter(r => r.title.trim().length > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validRows.length === 0) return
    setSaving(true)
    setError('')
    try {
      const tasks = await api.post<Task[]>('/api/tasks/bulk', {
        projectId,
        tasks: validRows.map(r => ({
          title:     r.title.trim(),
          taskType:  r.taskType || undefined,
          assignees: r.assigneeId ? [r.assigneeId] : undefined,
          dueDate:   r.dueDate || undefined,
        })),
      })
      onCreated(tasks)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear tareas')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#17394f]" />
            <h3 className="font-semibold text-slate-900">Agregar tareas en masa</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Table */}
          <div className="overflow-auto flex-1 px-6 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="text-left pb-2 pr-2 w-px">#</th>
                  <th className="text-left pb-2 pr-2">Título</th>
                  <th className="text-left pb-2 pr-2 w-36">Tipo</th>
                  <th className="text-left pb-2 pr-2 w-36">Asignar a</th>
                  <th className="text-left pb-2 pr-2 w-32">Fecha límite</th>
                  <th className="pb-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row, i) => (
                  <tr key={row._id} className="group">
                    {/* Número */}
                    <td className="py-1.5 pr-2 text-slate-300 text-xs tabular-nums align-middle">
                      {i + 1}
                    </td>

                    {/* Título */}
                    <td className="py-1.5 pr-2 align-middle">
                      <input
                        placeholder="Nombre de la tarea…"
                        className={INPUT}
                        value={row.title}
                        onChange={e => updateRow(row._id, 'title', e.target.value)}
                        autoFocus={i === 0}
                      />
                    </td>

                    {/* Tipo */}
                    <td className="py-1.5 pr-2 align-middle">
                      <select
                        className={INPUT}
                        value={row.taskType}
                        onChange={e => updateRow(row._id, 'taskType', e.target.value)}
                      >
                        <option value="">Sin tipo</option>
                        {TASK_TYPE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* Asignado a */}
                    <td className="py-1.5 pr-2 align-middle">
                      <select
                        className={INPUT}
                        value={row.assigneeId}
                        onChange={e => updateRow(row._id, 'assigneeId', e.target.value)}
                      >
                        <option value="">Sin asignar</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Fecha */}
                    <td className="py-1.5 pr-2 align-middle">
                      <input
                        type="date"
                        className={INPUT}
                        value={row.dueDate}
                        onChange={e => updateRow(row._id, 'dueDate', e.target.value)}
                      />
                    </td>

                    {/* Eliminar */}
                    <td className="py-1.5 align-middle">
                      <button
                        type="button"
                        onClick={() => removeRow(row._id)}
                        disabled={rows.length === 1}
                        className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Agregar fila */}
            <button
              type="button"
              onClick={addRow}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-[#17394f] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar fila
            </button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <span className="text-xs text-slate-400">
              {validRows.length} tarea{validRows.length !== 1 ? 's' : ''} lista{validRows.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-3">
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || validRows.length === 0}
                className="bg-[#17394f] hover:bg-[#17394f]/90 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {saving ? 'Creando…' : `Crear ${validRows.length > 0 ? validRows.length : ''} tarea${validRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
