'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const INDUSTRIES = [
  'Publicidad y Marketing',
  'Moda y Retail',
  'Alimentos y Bebidas',
  'Tecnología',
  'Salud y Bienestar',
  'Educación',
  'Inmobiliaria',
  'Entretenimiento',
  'Turismo y Hospitalidad',
  'ONG / Sin fines de lucro',
  'Gobierno',
  'Otro',
]

const TIERS = [
  { value: 'REGULAR',   label: 'Regular' },
  { value: 'PUNCTUAL',  label: 'Puntual' },
  { value: 'STRATEGIC', label: 'Estratégico' },
]

export function NewClientModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Required
  const [name, setName]               = useState('')
  const [contactName, setContactName] = useState('')
  const [contactInfo, setContactInfo] = useState('')

  // Optional
  const [industry, setIndustry]           = useState('')
  const [tier, setTier]                   = useState('REGULAR')
  const [website, setWebsite]             = useState('')
  const [description, setDescription]     = useState('')
  const [relationStart, setRelationStart] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function resetForm() {
    setName(''); setContactName(''); setContactInfo('')
    setIndustry(''); setTier('REGULAR'); setWebsite('')
    setDescription(''); setRelationStart('')
    setError('')
  }

  function handleClose() {
    setOpen(false)
    resetForm()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/api/clients', {
        name,
        contactName,
        contactInfo,
        ...(industry      && { industry }),
        tier,
        ...(website       && { website }),
        ...(description   && { description }),
        ...(relationStart && { relationStart: new Date(relationStart).toISOString() }),
      })
      handleClose()
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear cliente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        + Nuevo cliente
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={handleClose}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Nuevo cliente</h3>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Cliente */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Nombre del cliente *</label>
                <input
                  required
                  placeholder="Ej. Marca XYZ"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              {/* Industry + Tier */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Industria</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                  >
                    <option value="">— Seleccionar —</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Tier</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                    value={tier}
                    onChange={e => setTier(e.target.value)}
                  >
                    {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Website + Relation start */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Sitio web</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Cliente desde</label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={relationStart}
                    onChange={e => setRelationStart(e.target.value)}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Descripción</label>
                <textarea
                  rows={2}
                  placeholder="Contexto o notas sobre el cliente..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 pt-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contacto principal</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Nombre *</label>
                    <input
                      required
                      placeholder="Juan Pérez"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Email o teléfono *</label>
                    <input
                      required
                      placeholder="juan@marca.com"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      value={contactInfo}
                      onChange={e => setContactInfo(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg py-2 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2 transition-colors"
                >
                  {saving ? 'Creando...' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
