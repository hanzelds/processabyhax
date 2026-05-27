'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Client, Service } from '@/types'
import { api } from '@/lib/api'

interface Props {
  defaultClientId?: string
}

export function NewProjectModal({ defaultClientId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(!!defaultClientId)
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [clientId, setClientId] = useState(defaultClientId ?? '')
  const [serviceId, setServiceId] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [estimatedClose, setEstimatedClose] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Load service catalog once
    api.get<Service[]>('/api/services').then(setServices).catch(() => {})
  }, [])

  // Auto-fill name when service + client are selected (unless user has typed manually)
  useEffect(() => {
    if (nameTouched) return
    const client = clients.find(c => c.id === clientId)
    const service = services.find(s => s.id === serviceId)
    if (client && service) {
      setName(`${service.name} - ${client.name}`)
    } else {
      setName('')
    }
  }, [serviceId, clientId, clients, services, nameTouched])

  useEffect(() => {
    if (open && clients.length === 0) {
      api.get<Client[]>('/api/clients').then(data => {
        const active = data.filter(c => c.status === 'ACTIVE')
        setClients(active)
        // Only auto-select first client if no defaultClientId was provided
        if (!defaultClientId && active.length > 0) {
          setClientId(active[0].id)
        }
      }).catch(() => {})
    }
  }, [open, clients.length, defaultClientId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/api/projects', {
        name,
        clientId,
        description,
        startDate,
        estimatedClose: estimatedClose || undefined,
        serviceId: serviceId || undefined,
      })
      setOpen(false)
      setName(''); setNameTouched(false); setDescription(''); setEstimatedClose(''); setServiceId('')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        + Nuevo proyecto
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-900">Nuevo proyecto</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Nombre del proyecto *</label>
                <input
                  required
                  placeholder="Ej. Campaña verano 2026"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  value={name}
                  onChange={e => { setNameTouched(true); setName(e.target.value) }}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Cliente *</label>
                <select required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" value={clientId} onChange={e => { setNameTouched(false); setClientId(e.target.value) }}>
                  <option value="">Seleccionar cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {services.length > 0 && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Servicio (opcional)</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={serviceId}
                    onChange={e => { setNameTouched(false); setServiceId(e.target.value) }}
                  >
                    <option value="">Sin servicio asignado</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.icon ? `${s.icon} ` : ''}{s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Descripción</label>
                <textarea rows={2} placeholder="Descripción breve del proyecto" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Inicio *</label>
                  <input type="date" required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Cierre estimado</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" value={estimatedClose} onChange={e => setEstimatedClose(e.target.value)} />
                </div>
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button type="submit" disabled={saving || !clientId} className="w-full bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2 transition-colors mt-1">
                {saving ? 'Creando...' : 'Crear proyecto'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
