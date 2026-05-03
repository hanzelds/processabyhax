'use client'

import { useState } from 'react'
import { Client, ClientStatus, ClientTier } from '@/types'
import { CLIENT_STATUS_LABEL, CLIENT_STATUS_COLOR, CLIENT_TIER_LABEL, CLIENT_TIER_COLOR, formatDate, CLIENT_COLOR_PALETTE, clientBgColor } from '@/lib/utils'
import { api } from '@/lib/api'

const INDUSTRIES = [
  'Retail / Comercio', 'Alimentos y bebidas', 'Salud y bienestar', 'Moda y lifestyle',
  'Tecnología', 'Educación', 'Servicios financieros', 'Construcción e inmuebles',
  'Turismo y hospitalidad', 'Entretenimiento y cultura', 'ONG / Sector social', 'Otro',
]

interface Props { client: Client; onUpdate: (c: Client) => void }

export function ClientInfoBlock({ client, onUpdate }: Props) {
  const [editing, setEditing]           = useState(false)
  const [name, setName]                 = useState(client.name)
  const [status, setStatus]             = useState(client.status)
  const [tier, setTier]                 = useState(client.tier)
  const [industry, setIndustry]         = useState(client.industry ?? '')
  const [website, setWebsite]           = useState(client.website ?? '')
  const [description, setDescription]   = useState(client.description ?? '')
  const [relationStart, setRelationStart] = useState(client.relationStart?.slice(0, 10) ?? '')
  const [color, setColor]               = useState(client.color ?? '')
  const [saving, setSaving]             = useState(false)

  async function save() {
    setSaving(true)
    try {
      const updated = await api.patch<Client>(`/api/clients/${client.id}`, { name, status, tier, industry, website, description, relationStart: relationStart || null, color: color || null })
      onUpdate(updated)
      setEditing(false)
    } finally { setSaving(false) }
  }

  async function saveColor(hex: string) {
    setColor(hex)
    const updated = await api.patch<Client>(`/api/clients/${client.id}`, { color: hex })
    onUpdate(updated)
  }

  const currentColor = clientBgColor(client.id, color || client.color)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Color strip */}
      <div className="h-2 w-full" style={{ backgroundColor: currentColor }} />

      <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Información general</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-brand-700 hover:text-brand-800 font-medium transition-colors">Editar</button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Estado</label>
              <select value={status} onChange={e => setStatus(e.target.value as ClientStatus)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="POTENTIAL">Potencial</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Tier</label>
              <select value={tier} onChange={e => setTier(e.target.value as ClientTier)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="STRATEGIC">Estratégico</option>
                <option value="REGULAR">Regular</option>
                <option value="PUNCTUAL">Puntual</option>
                <option value="POTENTIAL">Potencial</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Industria</label>
            <select value={industry} onChange={e => setIndustry(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              <option value="">Sin especificar</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Sitio web</label>
              <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Inicio de relación</label>
              <input type="date" value={relationStart} onChange={e => setRelationStart(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Descripción interna</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Contexto sobre la marca, tono, expectativas..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">Color del cliente</label>
            <div className="flex flex-wrap gap-2">
              {CLIENT_COLOR_PALETTE.map(hex => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(hex)}
                  title={hex}
                  className={`w-7 h-7 rounded-full transition-all border-2 ${color === hex ? 'border-slate-700 scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: hex }}
                />
              ))}
              {/* Custom color input */}
              <label title="Color personalizado" className="w-7 h-7 rounded-full border-2 border-dashed border-slate-300 hover:border-slate-400 cursor-pointer flex items-center justify-center overflow-hidden relative transition-colors">
                <input
                  type="color"
                  value={color || '#3b82f6'}
                  onChange={e => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
                <span className="text-slate-400 text-xs font-bold pointer-events-none">+</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving || !name} className="flex-1 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60" style={{ background: '#17394f' }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => { setEditing(false); setColor(client.color ?? '') }} className="flex-1 py-2 text-sm text-slate-600 rounded-lg bg-slate-100 hover:bg-slate-200">Cancelar</button>
          </div>
        </div>
      ) : (
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <dt className="text-slate-500">Color</dt>
            <dd className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full border border-black/10" style={{ backgroundColor: currentColor }} />
              <span className="text-xs text-slate-400 font-mono">{color || client.color || 'auto'}</span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Estado</dt>
            <dd><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CLIENT_STATUS_COLOR[client.status]}`}>{CLIENT_STATUS_LABEL[client.status]}</span></dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Tier</dt>
            <dd><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CLIENT_TIER_COLOR[client.tier]}`}>{CLIENT_TIER_LABEL[client.tier]}</span></dd>
          </div>
          {client.industry && <div className="flex justify-between"><dt className="text-slate-500">Industria</dt><dd className="text-slate-700 text-right">{client.industry}</dd></div>}
          {client.website && <div className="flex justify-between"><dt className="text-slate-500">Web</dt><dd><a href={client.website} target="_blank" rel="noopener" className="text-brand-600 hover:underline text-xs truncate max-w-40 block text-right">{client.website.replace(/^https?:\/\//, '')}</a></dd></div>}
          {client.relationStart && <div className="flex justify-between"><dt className="text-slate-500">Cliente desde</dt><dd className="text-slate-700">{formatDate(client.relationStart)}</dd></div>}
          {client.description && (
            <div className="pt-2 border-t border-slate-100">
              <dt className="text-slate-500 mb-1">Descripción interna</dt>
              <dd className="text-slate-700 text-sm whitespace-pre-wrap">{client.description}</dd>
            </div>
          )}
        </dl>
      )}
      </div>
    </div>
  )
}
