'use client'

import { useState } from 'react'
import { AdminTask, AdminTaskCategory, AdminTaskPriority } from '@/types'
import { CATEGORY_ICON, CATEGORY_LABEL, PRIORITY_LABEL } from '@/lib/adminTasks'
import { api } from '@/lib/api'

const CATEGORIES: AdminTaskCategory[] = [
  'EQUIPO', 'FINANZAS', 'LEGAL_CONTRATOS', 'INFRAESTRUCTURA', 'ESTRATEGIA', 'OPERACIONES', 'OTRO',
]
const PRIORITIES: AdminTaskPriority[] = ['URGENTE', 'ALTA', 'NORMAL', 'BAJA']

interface Props {
  task?: AdminTask // if editing
  onClose: () => void
  onSaved: (task: AdminTask) => void
}

export function AdminTaskForm({ task, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [category, setCategory] = useState<AdminTaskCategory>(task?.category ?? 'OTRO')
  const [priority, setPriority] = useState<AdminTaskPriority>(task?.priority ?? 'NORMAL')
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? task.dueDate.split('T')[0] : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('El título es requerido'); return }

    setSaving(true)
    setError('')
    try {
      const payload = { title: title.trim(), description: description.trim() || null, category, priority, dueDate: dueDate || null }
      const result = task
        ? await api.patch<AdminTask>(`/api/admin/tasks/${task.id}`, payload)
        : await api.post<AdminTask>('/api/admin/tasks', payload)
      onSaved(result)
    } catch (err: any) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{task ? 'Editar tarea' : 'Nueva tarea administrativa'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Título *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Renovar dominio hax.com.do"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>

          {/* Category + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Categoría *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as AdminTaskCategory)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_ICON[c]} {CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Prioridad *</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as AdminTaskPriority)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha límite</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Contexto, instrucciones, links relevantes..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50"
              style={{ background: '#17394f' }}
            >
              {saving ? 'Guardando…' : task ? 'Guardar cambios' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
