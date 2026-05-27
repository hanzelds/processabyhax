'use client'

import { useState, useMemo } from 'react'
import { Clapperboard, Plus, MapPin, Users, Package, Truck, ChevronLeft, ChevronRight, X, Check, Calendar, Building2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Shoot } from '@/types'
import { LogisticaTabs } from '@/components/logistica/LogisticaTabs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const STATUS_OPTIONS = [
  { value: '',            label: 'Todos' },
  { value: 'DRAFT',       label: 'Borrador' },
  { value: 'CONFIRMED',   label: 'Confirmado' },
  { value: 'IN_PROGRESS', label: 'En rodaje' },
  { value: 'COMPLETED',   label: 'Completado' },
  { value: 'CANCELLED',   label: 'Cancelado' },
]

const STATUS_BADGE: Record<string, string> = {
  DRAFT:       'bg-slate-100 text-slate-500',
  CONFIRMED:   'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  COMPLETED:   'bg-emerald-50 text-emerald-700',
  CANCELLED:   'bg-red-50 text-red-500',
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', CONFIRMED: 'Confirmado', IN_PROGRESS: 'En rodaje', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_SHORT = ['L','M','M','J','V','S','D']

interface SimpleClient { id: string; name: string }

interface NuevoRodajeModalProps {
  onSave: (shoot: Shoot) => void
  onClose: () => void
  clients: SimpleClient[]
}

function NuevoRodajeModal({ onSave, onClose, clients }: NuevoRodajeModalProps) {
  const [form, setForm] = useState({
    title:     '',
    shootDate: new Date().toISOString().slice(0, 10),
    endDate:   '',
    status:    'DRAFT',
    clientId:  '',
    notes:     '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.title || !form.shootDate) return
    setSaving(true)
    try {
      const payload = {
        title:     form.title,
        shootDate: form.shootDate,
        endDate:   form.endDate   || undefined,
        status:    form.status,
        clientId:  form.clientId  || undefined,
        notes:     form.notes     || undefined,
      }
      const saved = await api.post<Shoot>('/api/shoots', payload)
      onSave(saved)
    } catch { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">Nuevo rodaje</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Título *</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Cliente</label>
            <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f]">
              <option value="">Sin cliente</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Fecha de inicio *</label>
              <input type="date" value={form.shootDate} onChange={e => setForm(f => ({ ...f, shootDate: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Fecha de fin</label>
              <input type="date" value={form.endDate} min={form.shootDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f]">
              {STATUS_OPTIONS.slice(1).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f] resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 text-sm border border-slate-200 rounded-lg py-2 hover:bg-slate-50 text-slate-600">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.title || !form.shootDate} className="flex-1 flex items-center justify-center gap-2 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg py-2 disabled:opacity-50">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            Crear rodaje
          </button>
        </div>
      </div>
    </div>
  )
}

function MiniCalendar({ shoots, onDayClick }: { shoots: Shoot[]; onDayClick: (date: string) => void }) {
  const today = new Date()
  const [calYear, setCalYear]   = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  const shootDates = useMemo(() => {
    const set = new Set<string>()
    shoots.forEach(s => {
      const d = s.shootDate.slice(0, 10)
      set.add(d)
    })
    return set
  }, [shoots])

  const firstDay  = new Date(calYear, calMonth, 1)
  const lastDay   = new Date(calYear, calMonth + 1, 0)
  // Day of week for first (0=Sun → shift to Mon-first)
  const startDow  = (firstDay.getDay() + 6) % 7
  const daysInMonth = lastDay.getDate()
  const cells = Array.from({ length: startDow + daysInMonth }, (_, i) => {
    if (i < startDow) return null
    const day = i - startDow + 1
    return day
  })

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 w-64 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-xs font-semibold text-slate-700 capitalize">{MONTHS[calMonth]} {calYear}</span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAYS_SHORT.map((d, i) => <div key={i} className="text-center text-[10px] font-medium text-slate-400 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const hasShoot = shootDates.has(dateStr)
          const isToday  = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day
          return (
            <button
              key={i}
              onClick={() => hasShoot && onDayClick(dateStr)}
              className={`aspect-square flex flex-col items-center justify-center rounded-md text-[11px] transition-colors relative
                ${hasShoot ? 'cursor-pointer hover:bg-[#17394f]/10' : 'cursor-default'}
                ${isToday ? 'font-bold text-[#17394f]' : 'text-slate-600'}
              `}
            >
              {day}
              {hasShoot && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#17394f]" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function RodajesClient({ shoots: initialShoots, userRole, clients }: { shoots: Shoot[]; userRole: string; clients: SimpleClient[] }) {
  const [shoots, setShoots]     = useState(initialShoots)
  const [statusFilter, setStatus] = useState('')
  const [dayFilter, setDayFilter] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showCal, setShowCal]     = useState(false)
  const canEdit = userRole !== 'TEAM'
  const router = useRouter()

  const filtered = useMemo(() => shoots.filter(s =>
    (!statusFilter || s.status === statusFilter) &&
    (!dayFilter    || s.shootDate.startsWith(dayFilter))
  ), [shoots, statusFilter, dayFilter])

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, Shoot[]>()
    filtered.forEach(s => {
      const key = s.shootDate.slice(0, 7) // "YYYY-MM"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    })
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  function handleSaved(saved: Shoot) {
    setShoots(prev => [saved, ...prev])
    setShowModal(false)
    router.push(`/logistica/rodajes/${saved.id}`)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr.slice(0, 10) + 'T12:00').toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  function monthLabel(key: string) {
    const [year, month] = key.split('-')
    return `${MONTHS[parseInt(month) - 1]} ${year}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LogisticaTabs />
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-semibold text-slate-900">Rodajes <span className="text-sm font-normal text-slate-400 ml-1">{filtered.length}</span></h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCal(c => !c)} className={`flex items-center gap-2 text-sm font-medium rounded-lg px-3 py-2 transition-colors border ${showCal ? 'bg-[#17394f] text-white border-[#17394f]' : 'bg-white border-slate-200 text-slate-600 hover:border-[#17394f]/30'}`}>
              <Calendar className="w-4 h-4" />
            </button>
            {canEdit && (
              <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
                <Plus className="w-4 h-4" /> Nuevo rodaje
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_OPTIONS.map(s => (
              <button key={s.value} onClick={() => { setStatus(s.value); setDayFilter(null) }} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${statusFilter === s.value && !dayFilter ? 'bg-[#17394f] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-[#17394f]/30'}`}>
                {s.label}
              </button>
            ))}
          </div>
          {dayFilter && (
            <button onClick={() => setDayFilter(null)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium bg-[#17394f]/10 text-[#17394f] border border-[#17394f]/20">
              {new Date(dayFilter + 'T12:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}
              <X className="w-3 h-3 ml-0.5" />
            </button>
          )}
        </div>

        <div className="flex gap-6">
          {/* Calendar sidebar */}
          {showCal && (
            <MiniCalendar shoots={shoots} onDayClick={d => { setDayFilter(d); setStatus('') }} />
          )}

          {/* List */}
          <div className="flex-1 min-w-0">
            {grouped.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Clapperboard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sin rodajes registrados</p>
              </div>
            ) : (
              <div className="space-y-6">
                {grouped.map(([monthKey, monthShoots]) => (
                  <div key={monthKey}>
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 capitalize">{monthLabel(monthKey)}</h2>
                    <div className="space-y-2">
                      {monthShoots.map(shoot => (
                        <Link key={shoot.id} href={`/logistica/rodajes/${shoot.id}`} className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-4 py-3.5 hover:shadow-sm transition-shadow group">
                          {/* Date badge */}
                          <div className="shrink-0 w-12 text-center">
                            <p className="text-lg font-bold text-slate-800 leading-none">{new Date(shoot.shootDate.slice(0, 10) + 'T12:00').getDate()}</p>
                            <p className="text-[10px] text-slate-400 uppercase">{new Date(shoot.shootDate.slice(0, 10) + 'T12:00').toLocaleDateString('es-DO', { month: 'short' })}</p>
                          </div>

                          {/* Divider */}
                          <div className="w-px h-8 bg-slate-100 shrink-0" />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 group-hover:text-[#17394f] transition-colors truncate">{shoot.title}</p>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              {shoot.client && (
                                <span className="flex items-center gap-1 text-xs text-slate-400">
                                  <Building2 className="w-3 h-3" />{shoot.client.name}
                                </span>
                              )}
                              {shoot.location && (
                                <span className="flex items-center gap-1 text-xs text-slate-400">
                                  <MapPin className="w-3 h-3" />{shoot.location.name}
                                </span>
                              )}
                              {(shoot._count?.crew ?? 0) > 0 && (
                                <span className="flex items-center gap-1 text-xs text-slate-400">
                                  <Users className="w-3 h-3" />{shoot._count!.crew}
                                </span>
                              )}
                              {(shoot._count?.gear ?? 0) > 0 && (
                                <span className="flex items-center gap-1 text-xs text-slate-400">
                                  <Package className="w-3 h-3" />{shoot._count!.gear}
                                </span>
                              )}
                              {(shoot._count?.vehicles ?? 0) > 0 && (
                                <span className="flex items-center gap-1 text-xs text-slate-400">
                                  <Truck className="w-3 h-3" />{shoot._count!.vehicles}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Status */}
                          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[shoot.status] ?? 'bg-slate-100 text-slate-500'}`}>
                            {STATUS_LABEL[shoot.status] ?? shoot.status}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <NuevoRodajeModal onSave={handleSaved} onClose={() => setShowModal(false)} clients={clients} />
      )}
    </div>
  )
}
