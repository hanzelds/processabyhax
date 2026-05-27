'use client'

import { useState } from 'react'
import { MapPin, Plus, Pencil, Trash2, X, Check, MoreVertical, Camera, DollarSign } from 'lucide-react'
import { api } from '@/lib/api'
import { LocationItem } from '@/types'
import { LogisticaTabs } from '@/components/logistica/LogisticaTabs'
import Link from 'next/link'

interface LocacionModalProps {
  item?: LocationItem | null
  onSave: (item: LocationItem) => void
  onClose: () => void
}

function LocacionModal({ item, onSave, onClose }: LocacionModalProps) {
  const [form, setForm] = useState({
    name:         item?.name         ?? '',
    address:      item?.address      ?? '',
    contactName:  item?.contactName  ?? '',
    contactPhone: item?.contactPhone ?? '',
    contactEmail: item?.contactEmail ?? '',
    costPerDay:   item?.costPerDay   ? String(item.costPerDay) : '',
    notes:        item?.notes        ?? '',
  })
  const [photoUrls, setPhotoUrls] = useState<string[]>(item?.photoUrls ?? [])
  const [newPhoto, setNewPhoto]   = useState('')
  const [saving, setSaving]       = useState(false)

  async function handleSave() {
    if (!form.name) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        costPerDay:   form.costPerDay   ? parseFloat(form.costPerDay)  : undefined,
        address:      form.address      || undefined,
        contactName:  form.contactName  || undefined,
        contactPhone: form.contactPhone || undefined,
        contactEmail: form.contactEmail || undefined,
        notes:        form.notes        || undefined,
        photoUrls,
      }
      const saved = item
        ? await api.patch<LocationItem>(`/api/locations/${item.id}`, payload)
        : await api.post<LocationItem>('/api/locations', payload)
      onSave(saved)
    } catch { setSaving(false) }
  }

  function addPhoto() {
    const url = newPhoto.trim()
    if (!url) return
    setPhotoUrls(prev => [...prev, url])
    setNewPhoto('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">{item ? 'Editar locación' : 'Agregar locación'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nombre *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Dirección</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Contacto</label>
            <input type="text" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Teléfono</label>
            <input type="text" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
            <input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Costo/día (RD$)</label>
            <input type="number" min="0" value={form.costPerDay} onChange={e => setForm(f => ({ ...f, costPerDay: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f] resize-none" />
          </div>
          {/* Photo URLs */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Fotos (URLs)</label>
            {photoUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {photoUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-200" onError={e => (e.currentTarget.style.display = 'none')} />
                    <button onClick={() => setPhotoUrls(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={newPhoto} onChange={e => setNewPhoto(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPhoto()} placeholder="https://..." className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
              <button onClick={addPhoto} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 text-sm transition-colors">Agregar</button>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 text-sm border border-slate-200 rounded-lg py-2 hover:bg-slate-50 text-slate-600">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.name} className="flex-1 flex items-center justify-center gap-2 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg py-2 disabled:opacity-50">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            {item ? 'Guardar' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LocacionesClient({ locations: initialLocations, userRole }: { locations: LocationItem[]; userRole: string }) {
  const [locations, setLocations] = useState(initialLocations)
  const [modal, setModal]         = useState<null | 'new' | LocationItem>(null)
  const [menuId, setMenuId]       = useState<string | null>(null)
  const canEdit = userRole !== 'TEAM'

  function handleSaved(saved: LocationItem) {
    setLocations(prev => {
      const idx = prev.findIndex(l => l.id === saved.id)
      return idx >= 0 ? prev.map(l => l.id === saved.id ? saved : l) : [saved, ...prev]
    })
    setModal(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Archivar esta locación?')) return
    try {
      await api.delete(`/api/locations/${id}`)
      setLocations(prev => prev.filter(l => l.id !== id))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al archivar')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LogisticaTabs />
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-semibold text-slate-900">Locaciones <span className="text-sm font-normal text-slate-400 ml-1">{locations.length}</span></h1>
          {canEdit && (
            <button onClick={() => setModal('new')} className="flex items-center gap-2 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
              <Plus className="w-4 h-4" /> Agregar locación
            </button>
          )}
        </div>

        {/* Grid */}
        {locations.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin locaciones registradas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map(item => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow relative group">
                {/* Thumbnail */}
                <Link href={`/logistica/locaciones/${item.id}`} className="block">
                  <div className="h-36 bg-slate-100 relative overflow-hidden">
                    {item.photoUrls?.[0] ? (
                      <img src={item.photoUrls[0]} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="w-8 h-8 text-slate-300" />
                      </div>
                    )}
                    {(item.photoUrls?.length ?? 0) > 1 && (
                      <span className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full">{item.photoUrls.length} fotos</span>
                    )}
                  </div>
                </Link>

                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <Link href={`/logistica/locaciones/${item.id}`}>
                        <p className="text-sm font-semibold text-slate-800 leading-tight hover:text-[#17394f] transition-colors truncate">{item.name}</p>
                      </Link>
                      {item.address && <p className="text-xs text-slate-400 mt-0.5 truncate">{item.address}</p>}
                    </div>
                    {canEdit && (
                      <div className="relative ml-2 shrink-0">
                        <button onClick={() => setMenuId(menuId === item.id ? null : item.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuId === item.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-[120px]">
                            <button onClick={() => { setModal(item); setMenuId(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Pencil className="w-3.5 h-3.5" />Editar</button>
                            {userRole === 'ADMIN' && <button onClick={() => { handleDelete(item.id); setMenuId(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" />Archivar</button>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                    {item.costPerDay ? (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <DollarSign className="w-3 h-3" />
                        RD${Number(item.costPerDay).toLocaleString()}/día
                      </span>
                    ) : <span />}
                    {(item._count?.shoots ?? 0) > 0 && (
                      <span className="text-[10px] text-slate-400">{item._count!.shoots} rodaje{item._count!.shoots !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <LocacionModal
          item={modal === 'new' ? null : modal}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
