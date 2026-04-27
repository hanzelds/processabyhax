'use client'

import { useState } from 'react'
import { AdminTask } from '@/types'
import { api } from '@/lib/api'

interface Props {
  task: AdminTask
  onClose: () => void
  onCompleted: (task: AdminTask) => void
}

export function CompleteTaskModal({ task, onClose, onCompleted }: Props) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await api.patch<AdminTask>(`/api/admin/tasks/${task.id}/complete`, {
        resolutionNotes: notes.trim() || null,
      })
      onCompleted(result)
    } catch (err: any) {
      setError(err.message || 'Error al completar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Completar tarea</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3">
            <p className="text-sm text-green-800 font-medium">{task.title}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              📝 Notas de resolución <span className="text-slate-400">(recomendado)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="¿Cómo se resolvió? Pasos seguidos, links, credenciales relevantes para la próxima vez..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
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
              className="flex-1 py-2 rounded-lg text-sm text-white font-medium bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Completando…' : '✓ Marcar como completada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
