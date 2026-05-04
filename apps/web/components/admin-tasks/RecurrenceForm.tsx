'use client'

import { useState } from 'react'
import { AdminTaskCategory, AdminTaskPriority, AdminTaskRecurrence, RecurrenceFrequency } from '@/types'
import { CATEGORY_ICON, CATEGORY_LABEL, PRIORITY_LABEL, PRIORITY_COLOR, FREQUENCY_LABEL } from '@/lib/adminTasks'
import { api } from '@/lib/api'
import { X, Loader2 } from 'lucide-react'

const CATEGORIES: AdminTaskCategory[] = [
  'EQUIPO', 'FINANZAS', 'LEGAL_CONTRATOS', 'INFRAESTRUCTURA', 'ESTRATEGIA', 'OPERACIONES', 'OTRO',
]
const PRIORITIES: AdminTaskPriority[]   = ['URGENTE', 'ALTA', 'NORMAL', 'BAJA']
const FREQUENCIES: RecurrenceFrequency[] = ['DIARIO', 'SEMANAL', 'MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL']

interface Props {
  recurrence?: AdminTaskRecurrence
  onClose: () => void
  onSaved: (rec: AdminTaskRecurrence) => void
}

export function RecurrenceForm({ recurrence, onClose, onSaved }: Props) {
  const [title, setTitle]           = useState(recurrence?.title ?? '')
  const [description, setDescription] = useState(recurrence?.description ?? '')
  const [category, setCategory]     = useState<AdminTaskCategory>(recurrence?.category ?? 'OTRO')
  const [priority, setPriority]     = useState<AdminTaskPriority>(recurrence?.priority ?? 'NORMAL')
  const [frequency, setFrequency]   = useState<RecurrenceFrequency>(recurrence?.frequency ?? 'MENSUAL')
  const [advanceDays, setAdvanceDays] = useState(recurrence?.advanceDays ?? 0)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('El título es requerido'); return }
    setSaving(true)
    setError('')
    try {
      const payload = { title: title.trim(), description: description.trim() || null, category, priority, frequency, advanceDays }
      const result = recurrence
        ? await api.patch<AdminTaskRecurrence>(`/api/admin/tasks/recurrences/${recurrence.id}`, payload)
        : await api.post<AdminTaskRecurrence>('/api/admin/tasks/recurrences', payload)
      onSaved(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800">
            {recurrence ? 'Editar recurrencia' : 'Nueva tarea recurrente'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Título *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Pago de nómina"
              autoFocus
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/30 focus:border-[#17394f]/50 transition-colors"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Categoría *</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs transition-colors ${
                    category === c ? 'bg-[#17394f] text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-base">{CATEGORY_ICON[c]}</span>
                  <span className="text-[10px] text-center leading-tight">{CATEGORY_LABEL[c].split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Prioridad *</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-colors ${
                    priority === p
                      ? PRIORITY_COLOR[p] + ' ring-2 ring-offset-1 ring-current'
                      : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {PRIORITY_LABEL[p].toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Frecuencia *</label>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCIES.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                    frequency === f ? 'bg-[#17394f] text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {FREQUENCY_LABEL[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Advance days */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Días de anticipación
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={180}
                value={advanceDays}
                onChange={e => setAdvanceDays(parseInt(e.target.value) || 0)}
                className="w-24 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/30 text-center"
              />
              <p className="text-xs text-slate-400">días antes de la fecha para crear la tarea</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Descripción</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Instrucciones, pasos, contexto…"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/30 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#17394f] text-white text-sm font-semibold hover:bg-[#17394f]/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {recurrence ? 'Guardar cambios' : 'Crear recurrencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
