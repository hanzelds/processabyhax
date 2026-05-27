'use client'

import { useState, useMemo } from 'react'
import { Truck, Plus, Pencil, Trash2, X, Check, MoreVertical } from 'lucide-react'
import { api } from '@/lib/api'
import { VehicleItem } from '@/types'
import { LogisticaTabs } from '@/components/logistica/LogisticaTabs'

const STATUS_OPTIONS = [
  { value: '',            label: 'Todos' },
  { value: 'AVAILABLE',   label: 'Disponible' },
  { value: 'IN_USE',      label: 'En uso' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
  { value: 'RETIRED',     label: 'Retirado' },
]

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE:   'bg-emerald-50 text-emerald-700',
  IN_USE:      'bg-blue-50 text-blue-700',
  MAINTENANCE: 'bg-amber-50 text-amber-700',
  RETIRED:     'bg-slate-100 text-slate-500',
}
const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible', IN_USE: 'En uso', MAINTENANCE: 'Mantenimiento', RETIRED: 'Retirado',
}

const VEHICLE_TYPES = [
  { value: 'VAN',        label: 'Van' },
  { value: 'SUV',        label: 'SUV' },
  { value: 'SEDAN',      label: 'Sedán' },
  { value: 'PICKUP',     label: 'Pickup' },
  { value: 'MOTORCYCLE', label: 'Motocicleta' },
  { value: 'OTHER',      label: 'Otro' },
]

interface VehiculoModalProps {
  item?: VehicleItem | null
  onSave: (item: VehicleItem) => void
  onClose: () => void
}

function VehiculoModal({ item, onSave, onClose }: VehiculoModalProps) {
  const [form, setForm] = useState({
    name:     item?.name     ?? '',
    plate:    item?.plate    ?? '',
    type:     item?.type     ?? 'VAN',
    brand:    item?.brand    ?? '',
    model:    item?.model    ?? '',
    year:     item?.year     ? String(item.year) : '',
    color:    item?.color    ?? '',
    status:   item?.status   ?? 'AVAILABLE',
    notes:    item?.notes    ?? '',
    imageUrl: item?.imageUrl ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name || !form.plate || !form.type) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        year:     form.year     ? parseInt(form.year)     : undefined,
        brand:    form.brand    || undefined,
        model:    form.model    || undefined,
        color:    form.color    || undefined,
        notes:    form.notes    || undefined,
        imageUrl: form.imageUrl || undefined,
      }
      const saved = item
        ? await api.patch<VehicleItem>(`/api/vehicles/${item.id}`, payload)
        : await api.post<VehicleItem>('/api/vehicles', payload)
      onSave(saved)
    } catch { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">{item ? 'Editar vehículo' : 'Agregar vehículo'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nombre *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
          </div>
          {/* Plate */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Placa *</label>
            <input type="text" value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f] font-mono" />
          </div>
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Tipo *</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f]">
              {VEHICLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {/* Brand */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Marca</label>
            <input type="text" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
          </div>
          {/* Model */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Modelo</label>
            <input type="text" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
          </div>
          {/* Year */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Año</label>
            <input type="number" min="1990" max="2030" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
          </div>
          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Color</label>
            <input type="text" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
          </div>
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f]">
              {STATUS_OPTIONS.slice(1).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* Image URL */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">URL de imagen</label>
            <input type="text" value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
          </div>
          {/* Notes */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Notas</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 text-sm border border-slate-200 rounded-lg py-2 hover:bg-slate-50 text-slate-600">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.name || !form.plate} className="flex-1 flex items-center justify-center gap-2 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg py-2 disabled:opacity-50">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            {item ? 'Guardar' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function VehiculosClient({ vehicles: initialVehicles, userRole }: { vehicles: VehicleItem[]; userRole: string }) {
  const [vehicles, setVehicles] = useState(initialVehicles)
  const [statusFilter, setStatus] = useState('')
  const [modal, setModal]         = useState<null | 'new' | VehicleItem>(null)
  const [menuId, setMenuId]       = useState<string | null>(null)
  const canEdit = userRole !== 'TEAM'

  const filtered = useMemo(() =>
    vehicles.filter(v => !statusFilter || v.status === statusFilter),
    [vehicles, statusFilter]
  )

  function handleSaved(saved: VehicleItem) {
    setVehicles(prev => {
      const idx = prev.findIndex(v => v.id === saved.id)
      return idx >= 0 ? prev.map(v => v.id === saved.id ? saved : v) : [saved, ...prev]
    })
    setModal(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este vehículo?')) return
    try {
      await api.delete(`/api/vehicles/${id}`)
      setVehicles(prev => prev.filter(v => v.id !== id))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LogisticaTabs />
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-semibold text-slate-900">Vehículos <span className="text-sm font-normal text-slate-400 ml-1">{filtered.length}</span></h1>
          {canEdit && (
            <button onClick={() => setModal('new')} className="flex items-center gap-2 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
              <Plus className="w-4 h-4" /> Agregar vehículo
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center gap-1">
            {STATUS_OPTIONS.map(s => (
              <button key={s.value} onClick={() => setStatus(s.value)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${statusFilter === s.value ? 'bg-[#17394f] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-[#17394f]/30'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin vehículos registrados</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(item => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow relative group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
                      : <Truck className="w-4 h-4 text-slate-400" />}
                  </div>
                  {canEdit && (
                    <div className="relative">
                      <button onClick={() => setMenuId(menuId === item.id ? null : item.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuId === item.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-[120px]">
                          <button onClick={() => { setModal(item); setMenuId(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Pencil className="w-3.5 h-3.5" />Editar</button>
                          {userRole === 'ADMIN' && <button onClick={() => { handleDelete(item.id); setMenuId(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" />Eliminar</button>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800 leading-tight mb-0.5">{item.name}</p>
                <p className="text-xs font-mono text-slate-400 mb-1">{item.plate}</p>
                {(item.brand || item.model || item.year) && (
                  <p className="text-xs text-slate-400 mb-2">{[item.brand, item.model, item.year].filter(Boolean).join(' · ')}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[item.status] ?? item.status}</span>
                  {item.color && <span className="text-[10px] text-slate-400 capitalize">{item.color}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <VehiculoModal
          item={modal === 'new' ? null : modal}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
