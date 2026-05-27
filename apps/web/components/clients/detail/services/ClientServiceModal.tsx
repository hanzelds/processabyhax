'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ClientService, Service } from '@/types'
import { api } from '@/lib/api'

interface Props {
  clientId: string
  editing: ClientService | null
  onClose: () => void
  onSaved: (cs: ClientService) => void
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE',    label: 'Activo' },
  { value: 'PAUSED',    label: 'Pausado' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'CANCELLED', label: 'Cancelado' },
]

export function ClientServiceModal({ clientId, editing, onClose, onSaved }: Props) {
  const [services, setServices] = useState<Service[]>([])
  const [serviceId, setServiceId] = useState(editing?.serviceId ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [status, setStatus] = useState(editing?.status ?? 'ACTIVE')
  const [startDate, setStartDate] = useState(editing?.startDate ? editing.startDate.slice(0, 10) : '')
  const [endDate, setEndDate] = useState(editing?.endDate ? editing.endDate.slice(0, 10) : '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<Service[]>('/api/services').then(setServices).catch(() => {})
  }, [])

  const selectedService = services.find(s => s.id === serviceId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!serviceId && !editing) { setError('Selecciona un servicio'); return }
    setLoading(true)
    setError('')
    try {
      let result: ClientService
      if (editing) {
        result = await api.patch<ClientService>(`/api/clients/${clientId}/services/${editing.id}`, {
          name: name || null,
          status,
          startDate: startDate || null,
          endDate: endDate || null,
          notes: notes || null,
        })
      } else {
        result = await api.post<ClientService>(`/api/clients/${clientId}/services`, {
          serviceId,
          name: name || null,
          status,
          startDate: startDate || null,
          endDate: endDate || null,
          notes: notes || null,
        })
      }
      onSaved(result)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {editing ? 'Editar suscripción' : 'Agregar servicio'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Service selector (only when creating) */}
          {!editing && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Servicio <span className="text-red-500">*</span>
              </label>
              <select
                value={serviceId}
                onChange={e => setServiceId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                required
              >
                <option value="">Seleccionar servicio...</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.icon ? `${s.icon} ` : ''}{s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Display selected service when editing */}
          {editing && (
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
              <span className="text-lg">{editing.service.icon || '🔧'}</span>
              <div>
                <p className="text-sm font-medium text-slate-800">{editing.service.name}</p>
                <p className="text-xs text-slate-400">Servicio base</p>
              </div>
            </div>
          )}

          {/* Custom name */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Nombre personalizado
              <span className="ml-1 text-slate-400 font-normal">
                (opcional{selectedService ? `, default: "${selectedService.name}"` : ''})
              </span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={selectedService?.name || editing?.service.name || 'Ej. Instagram Q1 2026'}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-700/30"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Estado</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as ClientService['status'])}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-700/30"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-700/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Fin</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-700/30"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Notas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Detalles adicionales..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-700/30 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-brand-700 text-white rounded-lg font-medium hover:bg-brand-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
