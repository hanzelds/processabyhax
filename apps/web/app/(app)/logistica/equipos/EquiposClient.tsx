'use client'

import { useState, useMemo } from 'react'
import { Package, Camera, Aperture, Zap, Wind, Mic2, Plus, Pencil, Trash2, X, Check, MoreVertical } from 'lucide-react'
import { api } from '@/lib/api'
import { GearItem } from '@/types'
import { LogisticaTabs } from '@/components/logistica/LogisticaTabs'

const CATEGORIES = [
  { value: '', label: 'Todos' },
  { value: 'CAMERA',     label: 'Cámaras' },
  { value: 'LENS',       label: 'Lentes' },
  { value: 'LIGHT',      label: 'Luces' },
  { value: 'DRONE',      label: 'Drones' },
  { value: 'MIC',        label: 'Micrófonos' },
  { value: 'AUDIO',      label: 'Audio' },
  { value: 'STABILIZER', label: 'Estabilizadores' },
  { value: 'SUPPORT',    label: 'Soporte' },
  { value: 'OTHER',      label: 'Otros' },
]

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

function CategoryIcon({ cat }: { cat: string }) {
  const cls = 'w-4 h-4 text-slate-400'
  if (cat === 'CAMERA')     return <Camera className={cls} />
  if (cat === 'LENS')       return <Aperture className={cls} />
  if (cat === 'LIGHT')      return <Zap className={cls} />
  if (cat === 'DRONE')      return <Wind className={cls} />
  if (cat === 'MIC' || cat === 'AUDIO') return <Mic2 className={cls} />
  return <Package className={cls} />
}

interface GearModalProps {
  item?: GearItem | null
  onSave: (item: GearItem) => void
  onClose: () => void
}

function GearModal({ item, onSave, onClose }: GearModalProps) {
  const [form, setForm] = useState({
    name:         item?.name         ?? '',
    category:     item?.category     ?? 'CAMERA',
    brand:        item?.brand        ?? '',
    model:        item?.model        ?? '',
    serialNumber: item?.serialNumber ?? '',
    status:       item?.status       ?? 'AVAILABLE',
    notes:        item?.notes        ?? '',
    imageUrl:     item?.imageUrl     ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name || !form.category) return
    setSaving(true)
    try {
      const payload = { ...form, brand: form.brand || undefined, model: form.model || undefined, serialNumber: form.serialNumber || undefined, notes: form.notes || undefined, imageUrl: form.imageUrl || undefined }
      const saved = item
        ? await api.patch<GearItem>(`/api/gear/${item.id}`, payload)
        : await api.post<GearItem>('/api/gear', payload)
      onSave(saved)
    } catch { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">{item ? 'Editar equipo' : 'Agregar equipo'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Nombre *', key: 'name', col: 2 },
            { label: 'Categoría *', key: 'category', type: 'select', options: CATEGORIES.slice(1), col: 1 },
            { label: 'Status', key: 'status', type: 'select', options: STATUS_OPTIONS.slice(1), col: 1 },
            { label: 'Marca', key: 'brand', col: 1 },
            { label: 'Modelo', key: 'model', col: 1 },
            { label: 'Serial', key: 'serialNumber', col: 2 },
            { label: 'URL de imagen', key: 'imageUrl', col: 2 },
            { label: 'Notas', key: 'notes', col: 2 },
          ].map(field => (
            <div key={field.key} className={field.col === 2 ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">{field.label}</label>
              {field.type === 'select' ? (
                <select value={(form as Record<string, string>)[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f]">
                  {field.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input type="text" value={(form as Record<string, string>)[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
              )}
            </div>
          ))}
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

export function EquiposClient({ gear: initialGear, userRole }: { gear: GearItem[]; userRole: string }) {
  const [gear, setGear]         = useState(initialGear)
  const [catFilter, setCat]     = useState('')
  const [statusFilter, setStatus] = useState('')
  const [modal, setModal]       = useState<null | 'new' | GearItem>(null)
  const [menuId, setMenuId]     = useState<string | null>(null)
  const canEdit = userRole !== 'TEAM'

  const filtered = useMemo(() => gear.filter(g =>
    (!catFilter    || g.category === catFilter) &&
    (!statusFilter || g.status   === statusFilter)
  ), [gear, catFilter, statusFilter])

  function handleSaved(saved: GearItem) {
    setGear(prev => {
      const idx = prev.findIndex(g => g.id === saved.id)
      return idx >= 0 ? prev.map(g => g.id === saved.id ? saved : g) : [saved, ...prev]
    })
    setModal(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este equipo?')) return
    try {
      await api.delete(`/api/gear/${id}`)
      setGear(prev => prev.filter(g => g.id !== id))
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
          <h1 className="text-lg font-semibold text-slate-900">Inventario de equipo <span className="text-sm font-normal text-slate-400 ml-1">{filtered.length}</span></h1>
          {canEdit && (
            <button onClick={() => setModal('new')} className="flex items-center gap-2 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
              <Plus className="w-4 h-4" /> Agregar equipo
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c.value} onClick={() => setCat(c.value)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${catFilter === c.value ? 'bg-[#17394f] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-[#17394f]/30'}`}>
                {c.label}
              </button>
            ))}
          </div>
          <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="ml-auto text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-600 outline-none">
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin equipo registrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(item => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow relative group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
                      : <CategoryIcon cat={item.category} />}
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
                {(item.brand || item.model) && <p className="text-xs text-slate-400 mb-2">{[item.brand, item.model].filter(Boolean).join(' · ')}</p>}
                {item.serialNumber && <p className="text-[10px] font-mono text-slate-400 mb-2">{item.serialNumber}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[item.status] ?? item.status}</span>
                  {(item._count?.shootGear ?? 0) > 0 && <span className="text-[10px] text-slate-400">{item._count!.shootGear} rodaje{item._count!.shootGear !== 1 ? 's' : ''}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <GearModal
          item={modal === 'new' ? null : modal}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
