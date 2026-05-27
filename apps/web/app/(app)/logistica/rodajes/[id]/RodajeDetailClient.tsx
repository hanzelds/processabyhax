'use client'

import React, { useState, useEffect } from 'react'
import {
  MapPin, Users, Package, Truck, ChevronLeft,
  Pencil, Printer, X, Check, Clock, User, Plus, Trash2,
  ExternalLink, Calendar, Building2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Shoot, GearItem, LocationItem, VehicleItem, ShootCrewMember, ShootGearItem, ShootVehicleItem } from '@/types'
import { LogisticaTabs } from '@/components/logistica/LogisticaTabs'
import Link from 'next/link'

/* ─── Print CSS ──────────────────────────────────────────────── */

const PRINT_STYLES = `
@media print {
  /* Ocultar todo via visibility para no colapsar el DOM */
  * { visibility: hidden !important; }

  /* Mostrar solo el call sheet y todos sus descendientes */
  #cs-print,
  #cs-print * { visibility: visible !important; }

  /* Posicionar el call sheet en la esquina superior izquierda */
  #cs-print {
    display: block !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    z-index: 99999 !important;
  }

  /* Evitar cortes de página en secciones y filas */
  .cs-section        { page-break-inside: avoid; }
  .cs-section-header { page-break-after: avoid; }
  .cs-row            { page-break-inside: avoid; }
}
`

/* ─── Call Sheet Print Component ─────────────────────────────── */

function StatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Borrador', CONFIRMED: 'Confirmado',
    IN_PROGRESS: 'En rodaje', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
  }
  return map[status] ?? status
}

function fmtPrintDate(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00').toLocaleDateString('es-DO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
function fmtPrintTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const CAT_LABELS: Record<string, string> = {
  CAMERA: 'Cámara', LENS: 'Lente', LIGHT: 'Luz', DRONE: 'Drone',
  MIC: 'Micrófono', AUDIO: 'Audio', STABILIZER: 'Estabilizador', SUPPORT: 'Soporte', OTHER: 'Otro',
}

const BRAND = '#17394f'

function CallSheetPrint({ shoot }: { shoot: Shoot }) {
  const generatedAt = new Date().toLocaleString('es-DO', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const cellStyle = (bg?: string): React.CSSProperties => ({
    padding: '7px 10px',
    fontSize: '10pt',
    color: '#1e293b',
    background: bg ?? 'transparent',
    borderBottom: '1px solid #e2e8f0',
  })
  const thStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: '8pt',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: '#64748b',
    background: '#f1f5f9',
    borderBottom: '2px solid #cbd5e1',
    textAlign: 'left' as const,
  }

  return (
    <div
      id="cs-print"
      style={{
        display: 'none',
        fontFamily: 'Georgia, "Times New Roman", serif',
        background: 'white',
        color: '#1e293b',
        padding: 0,
        margin: 0,
        width: '100%',
      }}
    >
      {/* ── Header ── */}
      <div style={{ background: BRAND, color: 'white', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <img src="/hax-logo.svg" alt="HAX" style={{ height: '36px', filter: 'brightness(0) invert(1)' }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18pt', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>Call Sheet</div>
          <div style={{ fontSize: '8pt', letterSpacing: '0.1em', opacity: 0.8, textTransform: 'uppercase' as const }}>Confidencial</div>
        </div>
      </div>

      {/* ── Title block ── */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `3px solid ${BRAND}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '20pt', fontWeight: 700, color: '#0f172a', lineHeight: 1.2, marginBottom: '6px' }}>
              {shoot.title}
            </div>
            <div style={{ fontSize: '11pt', color: '#475569', fontStyle: 'italic' }}>
              {fmtPrintDate(shoot.shootDate)}
              {shoot.endDate && shoot.endDate.slice(0, 10) !== shoot.shootDate.slice(0, 10) && (
                <> &rarr; {fmtPrintDate(shoot.endDate)}</>
              )}
            </div>
          </div>
          <div style={{
            border: `2px solid ${BRAND}`,
            color: BRAND,
            borderRadius: '4px',
            padding: '4px 12px',
            fontSize: '9pt',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            whiteSpace: 'nowrap' as const,
            flexShrink: 0,
          }}>
            {StatusLabel(shoot.status)}
          </div>
        </div>

        {/* Meta info grid */}
        {(shoot.client || shoot.location || shoot.project || shoot.notes) && (
          <table style={{ marginTop: '14px', borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {shoot.client && (
                <tr>
                  <td style={{ width: '110px', fontSize: '9pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '3px 0', verticalAlign: 'top' }}>Cliente</td>
                  <td style={{ fontSize: '10pt', padding: '3px 0', color: '#1e293b' }}>{shoot.client.name}</td>
                </tr>
              )}
              {shoot.location && (
                <tr>
                  <td style={{ width: '110px', fontSize: '9pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '3px 0', verticalAlign: 'top' }}>Locación</td>
                  <td style={{ fontSize: '10pt', padding: '3px 0', color: '#1e293b' }}>
                    {shoot.location.name}
                    {shoot.location.address && <span style={{ color: '#64748b' }}> · {shoot.location.address}</span>}
                    {shoot.location.contactName && <span style={{ color: '#64748b' }}> · Contacto: {shoot.location.contactName}</span>}
                    {shoot.location.contactPhone && <span style={{ color: '#64748b' }}> ({shoot.location.contactPhone})</span>}
                  </td>
                </tr>
              )}
              {shoot.project && (
                <tr>
                  <td style={{ width: '110px', fontSize: '9pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '3px 0', verticalAlign: 'top' }}>Proyecto</td>
                  <td style={{ fontSize: '10pt', padding: '3px 0', color: '#1e293b' }}>{shoot.project.name}</td>
                </tr>
              )}
              {shoot.brief && (
                <tr>
                  <td style={{ width: '110px', fontSize: '9pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '3px 0', verticalAlign: 'top' }}>Brief</td>
                  <td style={{ fontSize: '10pt', padding: '3px 0', color: '#1e293b' }}>{shoot.brief.title}</td>
                </tr>
              )}
              {shoot.notes && (
                <tr>
                  <td style={{ width: '110px', fontSize: '9pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '3px 0', verticalAlign: 'top' }}>Notas</td>
                  <td style={{ fontSize: '10pt', padding: '3px 0', color: '#1e293b', whiteSpace: 'pre-wrap' as const }}>{shoot.notes}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Crew ── */}
      <div className="cs-section" style={{ marginTop: '18px' }}>
        <div className="cs-section-header" style={{ background: BRAND, color: 'white', padding: '6px 20px', fontSize: '9pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
          Crew ({shoot.crew.length})
        </div>
        {shoot.crew.length === 0 ? (
          <div style={{ padding: '10px 20px', fontSize: '10pt', color: '#94a3b8', fontStyle: 'italic' }}>Sin crew asignado</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Nombre</th>
                <th style={thStyle}>Rol</th>
                <th style={{ ...thStyle, width: '120px' }}>Call Time</th>
              </tr>
            </thead>
            <tbody>
              {shoot.crew.map((c, i) => (
                <tr key={c.id} className="cs-row">
                  <td style={cellStyle(i % 2 === 1 ? '#f8fafc' : undefined)}>{c.user.name}</td>
                  <td style={cellStyle(i % 2 === 1 ? '#f8fafc' : undefined)}>{c.role}</td>
                  <td style={{ ...cellStyle(i % 2 === 1 ? '#f8fafc' : undefined), fontWeight: 700, fontFamily: 'monospace', fontSize: '11pt' }}>
                    {fmtPrintTime(c.callTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Gear ── */}
      <div className="cs-section" style={{ marginTop: '18px' }}>
        <div className="cs-section-header" style={{ background: BRAND, color: 'white', padding: '6px 20px', fontSize: '9pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
          Equipo ({shoot.gear.length})
        </div>
        {shoot.gear.length === 0 ? (
          <div style={{ padding: '10px 20px', fontSize: '10pt', color: '#94a3b8', fontStyle: 'italic' }}>Sin equipo asignado</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Equipo</th>
                <th style={{ ...thStyle, width: '130px' }}>Categoría</th>
                <th style={{ ...thStyle, width: '140px' }}>Serial</th>
              </tr>
            </thead>
            <tbody>
              {shoot.gear.map((g, i) => (
                <tr key={g.id} className="cs-row">
                  <td style={cellStyle(i % 2 === 1 ? '#f8fafc' : undefined)}>
                    <span style={{ fontWeight: 600 }}>{g.gearItem.name}</span>
                    {(g.gearItem.brand || g.gearItem.model) && (
                      <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {[g.gearItem.brand, g.gearItem.model].filter(Boolean).join(' ')}</span>
                    )}
                  </td>
                  <td style={cellStyle(i % 2 === 1 ? '#f8fafc' : undefined)}>{CAT_LABELS[g.gearItem.category] ?? g.gearItem.category}</td>
                  <td style={{ ...cellStyle(i % 2 === 1 ? '#f8fafc' : undefined), fontFamily: 'monospace', fontSize: '9pt', color: '#475569' }}>
                    {g.gearItem.serialNumber ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Vehicles ── */}
      <div className="cs-section" style={{ marginTop: '18px' }}>
        <div className="cs-section-header" style={{ background: BRAND, color: 'white', padding: '6px 20px', fontSize: '9pt', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
          Vehículos ({shoot.vehicles.length})
        </div>
        {shoot.vehicles.length === 0 ? (
          <div style={{ padding: '10px 20px', fontSize: '10pt', color: '#94a3b8', fontStyle: 'italic' }}>Sin vehículos asignados</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Vehículo</th>
                <th style={{ ...thStyle, width: '130px' }}>Placa</th>
                <th style={thStyle}>Chofer</th>
              </tr>
            </thead>
            <tbody>
              {shoot.vehicles.map((v, i) => (
                <tr key={v.id} className="cs-row">
                  <td style={cellStyle(i % 2 === 1 ? '#f8fafc' : undefined)}>
                    <span style={{ fontWeight: 600 }}>{v.vehicle.name}</span>
                    {v.vehicle.brand && (
                      <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {[v.vehicle.brand, v.vehicle.model].filter(Boolean).join(' ')}</span>
                    )}
                  </td>
                  <td style={{ ...cellStyle(i % 2 === 1 ? '#f8fafc' : undefined), fontFamily: 'monospace', fontWeight: 700 }}>{v.vehicle.plate}</td>
                  <td style={cellStyle(i % 2 === 1 ? '#f8fafc' : undefined)}>{v.driverName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ marginTop: '24px', paddingTop: '10px', borderTop: `2px solid ${BRAND}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 0' }}>
        <div style={{ fontSize: '8pt', color: '#64748b' }}>Generado el {generatedAt}</div>
        <div style={{ fontSize: '8pt', color: '#94a3b8', fontStyle: 'italic' }}>processa.hax.com.do</div>
      </div>
    </div>
  )
}

/* ─── constants ─────────────────────────────────────────────── */

const STATUS_OPTIONS = [
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

const CAT_LABEL: Record<string, string> = {
  CAMERA:'Cámara',LENS:'Lente',LIGHT:'Luz',DRONE:'Drone',
  MIC:'Micrófono',AUDIO:'Audio',STABILIZER:'Estabilizador',SUPPORT:'Soporte',OTHER:'Otro',
}

/* ─── small helpers ──────────────────────────────────────────── */

function fmt(dateStr: string) {
  return new Date(dateStr.slice(0, 10) + 'T12:00').toLocaleDateString('es-DO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
function fmtShort(dateStr: string) {
  return new Date(dateStr.slice(0, 10) + 'T12:00').toLocaleDateString('es-DO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
}

/* ─── Edit Metadata Modal ─────────────────────────────────────── */

interface SimpleClient { id: string; name: string }

interface EditMetaModalProps {
  shoot: Shoot
  locations: LocationItem[]
  clients: SimpleClient[]
  onSave: (s: Shoot) => void
  onClose: () => void
}

function EditMetaModal({ shoot, locations, clients, onSave, onClose }: EditMetaModalProps) {
  const [form, setForm] = useState({
    title:      shoot.title,
    status:     shoot.status,
    shootDate:  shoot.shootDate.slice(0, 10),
    endDate:    shoot.endDate?.slice(0, 10) ?? '',
    locationId: shoot.locationId ?? '',
    clientId:   shoot.clientId   ?? '',
    notes:      shoot.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.title) return
    setSaving(true)
    try {
      const saved = await api.patch<Shoot>(`/api/shoots/${shoot.id}`, {
        ...form,
        endDate:    form.endDate    || undefined,
        locationId: form.locationId || undefined,
        clientId:   form.clientId   || undefined,
        notes:      form.notes      || undefined,
      })
      onSave(saved)
    } catch { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">Editar rodaje</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Título</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]" />
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
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Fecha inicio</label>
              <input type="date" value={form.shootDate} onChange={e => setForm(f => ({ ...f, shootDate: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Fecha fin</label>
              <input type="date" value={form.endDate} min={form.shootDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f]">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Locación</label>
            <select value={form.locationId} onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f]">
              <option value="">Sin locación</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f] resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 text-sm border border-slate-200 rounded-lg py-2 hover:bg-slate-50 text-slate-600">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.title} className="flex-1 flex items-center justify-center gap-2 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg py-2 disabled:opacity-50">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Assign Crew Modal ───────────────────────────────────────── */

interface TeamUser { id: string; name: string; area?: string | null }

interface AssignCrewModalProps {
  shoot: Shoot
  onSave: (crew: ShootCrewMember[]) => void
  onClose: () => void
}

function AssignCrewModal({ shoot, onSave, onClose }: AssignCrewModalProps) {
  const [users, setUsers]   = useState<TeamUser[]>([])
  const [entries, setEntries] = useState<Array<{ userId: string; role: string; callTime: string }>>(
    shoot.crew.map(c => ({ userId: c.userId, role: c.role, callTime: c.callTime ? new Date(c.callTime).toISOString().slice(11, 16) : '' }))
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<TeamUser[]>('/api/users').then(setUsers).catch(() => {})
  }, [])

  function addEntry() {
    setEntries(prev => [...prev, { userId: '', role: '', callTime: '' }])
  }
  function removeEntry(i: number) {
    setEntries(prev => prev.filter((_, j) => j !== i))
  }

  async function handleSave() {
    const valid = entries.filter(e => e.userId && e.role)
    setSaving(true)
    try {
      const result = await api.put<Shoot>(`/api/shoots/${shoot.id}/crew`, {
        crew: valid.map(e => ({
          userId:   e.userId,
          role:     e.role,
          callTime: e.callTime ? `${shoot.shootDate.slice(0, 10)}T${e.callTime}:00` : undefined,
        }))
      })
      onSave(result.crew)
    } catch { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-5 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">Asignar crew</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {entries.map((entry, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
              <select value={entry.userId} onChange={e => setEntries(prev => prev.map((x, j) => j === i ? { ...x, userId: e.target.value } : x))} className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#17394f]">
                <option value="">Seleccionar</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input type="text" placeholder="Rol (e.g. Director)" value={entry.role} onChange={e => setEntries(prev => prev.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#17394f]" />
              <input type="time" value={entry.callTime} onChange={e => setEntries(prev => prev.map((x, j) => j === i ? { ...x, callTime: e.target.value } : x))} className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#17394f] w-24" />
              <button onClick={() => removeEntry(i)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button onClick={addEntry} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#17394f] transition-colors py-1">
            <Plus className="w-3.5 h-3.5" /> Agregar miembro
          </button>
        </div>
        <div className="flex gap-3 mt-5 shrink-0 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 text-sm border border-slate-200 rounded-lg py-2 hover:bg-slate-50 text-slate-600">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg py-2 disabled:opacity-50">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar crew
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Assign Gear Modal ───────────────────────────────────────── */

interface AssignGearModalProps {
  shoot: Shoot
  allGear: GearItem[]
  onSave: (gear: ShootGearItem[]) => void
  onClose: () => void
}

function AssignGearModal({ shoot, allGear, onSave, onClose }: AssignGearModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(shoot.gear.map(g => g.gearItemId)))
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')

  const filtered = allGear.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.brand ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const result = await api.put<Shoot>(`/api/shoots/${shoot.id}/gear`, {
        gear: Array.from(selected).map(id => ({ gearItemId: id }))
      })
      onSave(result.gear)
    } catch { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">Asignar equipo</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <input type="text" placeholder="Buscar equipo..." value={search} onChange={e => setSearch(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] mb-3 shrink-0" />
        <div className="overflow-y-auto flex-1 space-y-1">
          {filtered.map(item => (
            <label key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="w-4 h-4 rounded border-slate-300 accent-[#17394f]" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                <p className="text-xs text-slate-400">{CAT_LABEL[item.category] ?? item.category}{item.serialNumber ? ` · ${item.serialNumber}` : ''}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-3 mt-4 shrink-0 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 text-sm border border-slate-200 rounded-lg py-2 hover:bg-slate-50 text-slate-600">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg py-2 disabled:opacity-50">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Assign Vehicles Modal ───────────────────────────────────── */

interface AssignVehiclesModalProps {
  shoot: Shoot
  allVehicles: VehicleItem[]
  onSave: (vehicles: ShootVehicleItem[]) => void
  onClose: () => void
}

function AssignVehiclesModal({ shoot, allVehicles, onSave, onClose }: AssignVehiclesModalProps) {
  const [entries, setEntries] = useState<Array<{ vehicleId: string; driverName: string }>>(
    shoot.vehicles.map(v => ({ vehicleId: v.vehicleId, driverName: v.driverName ?? '' }))
  )
  const [saving, setSaving] = useState(false)

  function addEntry() {
    setEntries(prev => [...prev, { vehicleId: '', driverName: '' }])
  }
  function removeEntry(i: number) {
    setEntries(prev => prev.filter((_, j) => j !== i))
  }

  async function handleSave() {
    const valid = entries.filter(e => e.vehicleId)
    setSaving(true)
    try {
      const result = await api.put<Shoot>(`/api/shoots/${shoot.id}/vehicles`, {
        vehicles: valid.map(e => ({ vehicleId: e.vehicleId, driverName: e.driverName || undefined }))
      })
      onSave(result.vehicles)
    } catch { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-5 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">Asignar vehículos</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {entries.map((entry, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <select value={entry.vehicleId} onChange={e => setEntries(prev => prev.map((x, j) => j === i ? { ...x, vehicleId: e.target.value } : x))} className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#17394f]">
                <option value="">Seleccionar</option>
                {allVehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>)}
              </select>
              <input type="text" placeholder="Chofer (opcional)" value={entry.driverName} onChange={e => setEntries(prev => prev.map((x, j) => j === i ? { ...x, driverName: e.target.value } : x))} className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#17394f]" />
              <button onClick={() => removeEntry(i)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button onClick={addEntry} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#17394f] transition-colors py-1">
            <Plus className="w-3.5 h-3.5" /> Agregar vehículo
          </button>
        </div>
        <div className="flex gap-3 mt-5 shrink-0 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 text-sm border border-slate-200 rounded-lg py-2 hover:bg-slate-50 text-slate-600">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg py-2 disabled:opacity-50">
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────── */

type ActiveModal = null | 'edit' | 'crew' | 'gear' | 'vehicles'

export function RodajeDetailClient({
  shoot: initialShoot,
  allGear,
  allLocations,
  allVehicles,
  allClients,
  userRole,
  currentUserId,
}: {
  shoot: Shoot
  allGear: GearItem[]
  allLocations: LocationItem[]
  allVehicles: VehicleItem[]
  allClients: SimpleClient[]
  userRole: string
  currentUserId: string
}) {
  const [shoot, setShoot]   = useState(initialShoot)
  const [modal, setModal]   = useState<ActiveModal>(null)
  const canEdit = userRole !== 'TEAM'

  function handleMetaSaved(saved: Shoot) {
    setShoot(prev => ({ ...prev, ...saved }))
    setModal(null)
  }
  function handleCrewSaved(crew: ShootCrewMember[]) {
    setShoot(prev => ({ ...prev, crew }))
    setModal(null)
  }
  function handleGearSaved(gear: ShootGearItem[]) {
    setShoot(prev => ({ ...prev, gear }))
    setModal(null)
  }
  function handleVehiclesSaved(vehicles: ShootVehicleItem[]) {
    setShoot(prev => ({ ...prev, vehicles }))
    setModal(null)
  }

  return (
    <>
      <style>{PRINT_STYLES}</style>

      <div className="min-h-screen bg-gray-50">
        <LogisticaTabs />

        <div className="max-w-4xl mx-auto px-6 py-6">
          {/* Back */}
          <Link href="/logistica/rodajes" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-4 transition-colors print:hidden">
            <ChevronLeft className="w-4 h-4" /> Rodajes
          </Link>

          {/* Header card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900">{shoot.title}</h1>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[shoot.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {STATUS_OPTIONS.find(s => s.value === shoot.status)?.label ?? shoot.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {fmt(shoot.shootDate)}
                    {shoot.endDate && shoot.endDate !== shoot.shootDate && (
                      <> → {fmtShort(shoot.endDate)}</>
                    )}
                  </span>
                </div>
                {/* Links */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {shoot.client && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                      <Building2 className="w-3 h-3 text-slate-400" /> {shoot.client.name}
                    </span>
                  )}
                  {shoot.project && (
                    <Link href={`/projects/${shoot.project.id}`} className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#17394f] transition-colors">
                      <ExternalLink className="w-3 h-3" /> {shoot.project.name}
                    </Link>
                  )}
                  {shoot.brief && (
                    <span className="text-xs text-slate-400">Brief: {shoot.brief.title}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                {canEdit && (
                  <button onClick={() => setModal('edit')} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 hover:border-[#17394f]/30 rounded-lg px-3 py-1.5 transition-colors">
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                )}
                <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 hover:border-[#17394f]/30 rounded-lg px-3 py-1.5 transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Imprimir call sheet
                </button>
              </div>
            </div>

            {/* Location */}
            {shoot.location && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <Link href={`/logistica/locaciones/${shoot.locationId}`} className="text-sm font-medium text-slate-700 hover:text-[#17394f] transition-colors">
                    {shoot.location.name}
                  </Link>
                  {shoot.location.address && <p className="text-xs text-slate-400">{shoot.location.address}</p>}
                </div>
              </div>
            )}

            {/* Notes */}
            {shoot.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-400 mb-1">Notas</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{shoot.notes}</p>
              </div>
            )}
          </div>

          {/* Call Sheet */}
          <div className="space-y-5">

            {/* Crew */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" /> Crew ({shoot.crew.length})
                </h2>
                {canEdit && (
                  <button onClick={() => setModal('crew')} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#17394f] transition-colors print:hidden">
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                )}
              </div>
              {shoot.crew.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">Sin crew asignado</div>
              ) : (
                <div className="overflow-x-auto"><table className="w-full min-w-[380px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Nombre</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Rol</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Call time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shoot.crew.map(c => (
                      <tr key={c.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#17394f]/10 flex items-center justify-center shrink-0 overflow-hidden">
                              {c.user.avatarUrl
                                ? <img src={c.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                                : <User className="w-3 h-3 text-[#17394f]" />}
                            </div>
                            <span className="text-sm text-slate-800">{c.user.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">{c.role}</td>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-1 text-sm text-slate-600">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {fmtTime(c.callTime)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>

            {/* Gear */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" /> Equipo ({shoot.gear.length})
                </h2>
                {canEdit && (
                  <button onClick={() => setModal('gear')} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#17394f] transition-colors print:hidden">
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                )}
              </div>
              {shoot.gear.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">Sin equipo asignado</div>
              ) : (
                <div className="overflow-x-auto"><table className="w-full min-w-[380px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Equipo</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Categoría</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Serial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shoot.gear.map(g => (
                      <tr key={g.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3 text-sm text-slate-800 font-medium">
                          {g.gearItem.name}
                          {(g.gearItem.brand || g.gearItem.model) && (
                            <span className="text-slate-400 font-normal ml-1">· {[g.gearItem.brand, g.gearItem.model].filter(Boolean).join(' ')}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">{CAT_LABEL[g.gearItem.category] ?? g.gearItem.category}</td>
                        <td className="px-5 py-3 text-xs font-mono text-slate-400">{g.gearItem.serialNumber ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>

            {/* Vehicles */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-400" /> Vehículos ({shoot.vehicles.length})
                </h2>
                {canEdit && (
                  <button onClick={() => setModal('vehicles')} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#17394f] transition-colors print:hidden">
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                )}
              </div>
              {shoot.vehicles.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">Sin vehículos asignados</div>
              ) : (
                <div className="overflow-x-auto"><table className="w-full min-w-[380px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Vehículo</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Placa</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Chofer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shoot.vehicles.map(v => (
                      <tr key={v.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3 text-sm text-slate-800 font-medium">{v.vehicle.name}</td>
                        <td className="px-5 py-3 text-xs font-mono text-slate-600">{v.vehicle.plate}</td>
                        <td className="px-5 py-3 text-sm text-slate-600">{v.driverName ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === 'edit' && (
        <EditMetaModal shoot={shoot} locations={allLocations} clients={allClients} onSave={handleMetaSaved} onClose={() => setModal(null)} />
      )}
      {modal === 'crew' && (
        <AssignCrewModal shoot={shoot} onSave={handleCrewSaved} onClose={() => setModal(null)} />
      )}
      {modal === 'gear' && (
        <AssignGearModal shoot={shoot} allGear={allGear} onSave={handleGearSaved} onClose={() => setModal(null)} />
      )}
      {modal === 'vehicles' && (
        <AssignVehiclesModal shoot={shoot} allVehicles={allVehicles} onSave={handleVehiclesSaved} onClose={() => setModal(null)} />
      )}

      {/* Call sheet imprimible — solo visible durante @media print */}
      <CallSheetPrint shoot={shoot} />
    </>
  )
}
