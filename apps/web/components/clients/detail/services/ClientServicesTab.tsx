'use client'

import { useState } from 'react'
import { Plus, MoreVertical, Briefcase, Calendar, FolderOpen, Pencil, Trash2 } from 'lucide-react'
import type { ClientService, Role } from '@/types'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { ClientServiceModal } from './ClientServiceModal'

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:    'Activo',
  PAUSED:    'Pausado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    'bg-emerald-50 text-emerald-700',
  PAUSED:    'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-blue-50 text-blue-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

const STATUS_ORDER = ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']

interface Props {
  clientId: string
  initialServices: ClientService[]
  userRole: Role
}

export function ClientServicesTab({ clientId, initialServices, userRole }: Props) {
  const [services, setServices] = useState<ClientService[]>(initialServices)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ClientService | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const canWrite = userRole === 'ADMIN' || userRole === 'LEAD'
  const canDelete = userRole === 'ADMIN'

  const sorted = [...services].sort((a, b) =>
    STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  )

  async function handleDelete(cs: ClientService) {
    if (!confirm(`¿Eliminar suscripción "${cs.name || cs.service.name}"?`)) return
    try {
      await api.delete(`/api/clients/${clientId}/services/${cs.id}`)
      setServices(prev => prev.filter(s => s.id !== cs.id))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar'
      alert(msg)
    }
  }

  function handleSaved(updated: ClientService) {
    setServices(prev => {
      const idx = prev.findIndex(s => s.id === updated.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = updated
        return next
      }
      return [updated, ...prev]
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-slate-700">
          Servicios contratados
          <span className="ml-2 text-xs font-normal text-slate-400">({services.length})</span>
        </h3>
        {canWrite && (
          <button
            onClick={() => { setEditing(null); setModalOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 text-white rounded-lg text-sm font-medium hover:bg-brand-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar servicio
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay servicios registrados</p>
          {canWrite && (
            <button
              onClick={() => { setEditing(null); setModalOpen(true) }}
              className="mt-3 text-sm text-brand-700 hover:underline"
            >
              Agregar el primero
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(cs => (
            <div key={cs.id} className="relative bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Service icon/color dot */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: cs.service.color ? `${cs.service.color}20` : '#f1f5f9', color: cs.service.color || '#64748b' }}
                  >
                    {cs.service.icon || <Briefcase className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {cs.name || cs.service.name}
                    </p>
                    {cs.name && (
                      <p className="text-xs text-slate-400 truncate">{cs.service.name}</p>
                    )}
                  </div>
                </div>

                {/* Menu */}
                {canWrite && (
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setOpenMenu(openMenu === cs.id ? null : cs.id)}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenu === cs.id && (
                      <div className="absolute right-0 top-6 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-40">
                        <button
                          onClick={() => { setEditing(cs); setModalOpen(true); setOpenMenu(null) }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        {canDelete && (cs._count?.projects ?? 0) === 0 && (
                          <button
                            onClick={() => { handleDelete(cs); setOpenMenu(null) }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status badge */}
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-3 ${STATUS_COLOR[cs.status]}`}>
                {STATUS_LABEL[cs.status]}
              </span>

              {/* Dates */}
              {(cs.startDate || cs.endDate) && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span>
                    {cs.startDate ? formatDate(cs.startDate) : '—'}
                    {' → '}
                    {cs.endDate ? formatDate(cs.endDate) : '∞'}
                  </span>
                </div>
              )}

              {/* Projects counter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <FolderOpen className="w-3 h-3" />
                <span>{cs._count?.projects ?? 0} proyecto{(cs._count?.projects ?? 0) !== 1 ? 's' : ''}</span>
              </div>

              {/* Notes */}
              {cs.notes && (
                <p className="mt-2 text-xs text-slate-400 line-clamp-2">{cs.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Close menu on outside click */}
      {openMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
      )}

      {modalOpen && (
        <ClientServiceModal
          clientId={clientId}
          editing={editing}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
