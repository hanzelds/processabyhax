'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Client, ClientStatus } from '@/types'
import { api } from '@/lib/api'

export function EditClientButton({ client }: { client: Client }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(client.name)
  const [contactName, setContactName] = useState(client.contactName)
  const [contactInfo, setContactInfo] = useState(client.contactInfo)
  const [status, setStatus] = useState<ClientStatus>(client.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.patch(`/api/clients/${client.id}`, { name, contactName, contactInfo, status })
      setOpen(false)
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
        className="border border-slate-200 hover:border-slate-300 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        Editar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-900">Editar cliente</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Nombre</label>
                <input required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Contacto</label>
                <input required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" value={contactName} onChange={e => setContactName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Email / Teléfono</label>
                <input required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" value={contactInfo} onChange={e => setContactInfo(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Estado</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" value={status} onChange={e => setStatus(e.target.value as ClientStatus)}>
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button type="submit" disabled={saving} className="w-full bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2 transition-colors">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
