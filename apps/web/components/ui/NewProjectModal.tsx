'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Client } from '@/types'
import { api } from '@/lib/api'

export function NewProjectModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [estimatedClose, setEstimatedClose] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && clients.length === 0) {
      api.get<Client[]>('/api/clients').then(data => {
        const active = data.filter(c => c.status === 'ACTIVE')
        setClients(active)
        if (active.length > 0) setClientId(active[0].id)
      }).catch(() => {})
    }
  }, [open, clients.length])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/api/projects', { name, clientId, description, startDate, estimatedClose: estimatedClose || undefined })
      setOpen(false)
      setName(''); setDescription(''); setEstimatedClose('')
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-900">Nuevo proyecto</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Nombre del proyecto *</label>
                <input required placeholder="Ej. Campaña verano 2026" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Cliente *</label>
                <select required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" value={clientId} onChange={e => setClientId(e.target.value)}>
                  <option value="">Seleccionar cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Descripción</label>
                <textarea rows={2} placeholder="Descripción breve del proyecto" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
