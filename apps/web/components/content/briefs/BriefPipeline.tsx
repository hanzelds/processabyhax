'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ContentBrief, BriefStatus, User } from '@/types'
import {
  BRIEF_STATUS_LABEL, BRIEF_STATUS_COLOR, ALL_BRIEF_STATUSES,
  CONTENT_TYPE_ICON, CONTENT_TYPE_LABEL, PLATFORM_LABEL, PLATFORM_COLOR,
  clientBgColor, isLightColor,
} from '@/lib/utils'
import { api } from '@/lib/api'
import { BriefModal } from './BriefModal'
import { Plus, Clock, RefreshCw, LayoutGrid, List } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'

// ── Pipeline config ───────────────────────────────────────────────────────────

const PIPELINE_STATUSES: BriefStatus[] = [
  'idea', 'en_desarrollo', 'revision_interna', 'aprobacion_cliente',
  'aprobado', 'en_produccion', 'en_edicion', 'entregado',
]

const STATUS_ACCENT: Record<BriefStatus, { bar: string; border: string; dot: string }> = {
  idea:               { bar: 'bg-slate-300',    border: 'border-l-slate-300',    dot: 'bg-slate-400'    },
  en_desarrollo:      { bar: 'bg-blue-400',      border: 'border-l-blue-400',     dot: 'bg-blue-400'     },
  revision_interna:   { bar: 'bg-yellow-400',    border: 'border-l-yellow-400',   dot: 'bg-yellow-400'   },
  aprobacion_cliente: { bar: 'bg-orange-400',    border: 'border-l-orange-400',   dot: 'bg-orange-400'   },
  aprobado:           { bar: 'bg-teal-400',      border: 'border-l-teal-400',     dot: 'bg-teal-400'     },
  en_produccion:      { bar: 'bg-purple-500',    border: 'border-l-purple-500',   dot: 'bg-purple-500'   },
  en_edicion:         { bar: 'bg-indigo-500',    border: 'border-l-indigo-500',   dot: 'bg-indigo-500'   },
  entregado:          { bar: 'bg-emerald-500',   border: 'border-l-emerald-500',  dot: 'bg-emerald-500'  },
  cancelado:          { bar: 'bg-red-400',       border: 'border-l-red-400',      dot: 'bg-red-400'      },
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function timerColor(days: number, status: BriefStatus) {
  if (status === 'entregado' || status === 'cancelado') return 'text-slate-300'
  if (days <= 2) return 'text-slate-400'
  if (days <= 5) return 'text-amber-500 font-semibold'
  return 'text-red-500 font-semibold'
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div title={name} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ring-2 ring-white" style={{ backgroundColor: '#17394f' }}>
      {initials}
    </div>
  )
}

// ── BriefCard ────────────────────────────────────────────────────────────────

function BriefCard({ brief, onClick, onDragStart }: { brief: ContentBrief; onClick: () => void; onDragStart: (id: string) => void }) {
  const days   = daysSince(brief.updatedAt)
  const accent = STATUS_ACCENT[brief.status]
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('briefId', brief.id); onDragStart(brief.id) }}
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-100 border-l-4 ${accent.border} p-3 cursor-pointer hover:shadow-md hover:border-slate-200 hover:border-l-4 transition-all select-none`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        {(() => { const bg = clientBgColor(brief.clientId, brief.client.color); return (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full truncate max-w-[120px] ${isLightColor(bg) ? 'text-slate-800' : 'text-white'}`}
            style={{ backgroundColor: bg }}
          >
            {brief.client.name}
          </span>
        )})()}
        <span className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0 font-medium">
          <span>{CONTENT_TYPE_ICON[brief.type]}</span>
          <span>{CONTENT_TYPE_LABEL[brief.type]}</span>
        </span>
      </div>
      <p className="text-[13px] font-semibold text-slate-800 leading-snug mb-2.5 line-clamp-2">{brief.title}</p>
      {brief.platforms.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {brief.platforms.map(p => (
            <span key={p} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${PLATFORM_COLOR[p]}`}>{PLATFORM_LABEL[p]}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {brief.assignees.slice(0, 4).map(a => <Avatar key={a.id} name={a.user.name} />)}
          {brief.assignees.length > 4 && (
            <div className="w-6 h-6 rounded-full bg-slate-100 ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-slate-500">
              +{brief.assignees.length - 4}
            </div>
          )}
          {brief.assignees.length === 0 && <span className="text-[10px] text-slate-300 italic">Sin asignar</span>}
        </div>
        <div className="flex items-center gap-2">
          {brief.isRecurring && <span title="Recurrente" className="text-slate-400"><RefreshCw className="w-3 h-3" /></span>}
          <span className={`text-[10px] flex items-center gap-0.5 ${timerColor(days, brief.status)}`}>
            <Clock className="w-3 h-3" />
            {days === 0 ? 'Hoy' : `${days}d`}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Pipeline column ───────────────────────────────────────────────────────────

function PipelineColumn({ status, briefs, isAdmin, draggingId, onCardClick, onCardDragStart, onDrop, onCreateClick }: {
  status: BriefStatus; briefs: ContentBrief[]; isAdmin: boolean; draggingId: string | null
  onCardClick: (b: ContentBrief) => void; onCardDragStart: (id: string) => void
  onDrop: (targetStatus: BriefStatus) => void; onCreateClick: () => void
}) {
  const [isOver, setIsOver] = useState(false)
  const accent = STATUS_ACCENT[status]
  return (
    <div className="shrink-0 w-[272px] flex flex-col">
      <div>
        <div className={`h-1.5 w-full ${accent.bar} rounded-t-xl`} />
        <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border border-slate-200 border-t-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${accent.dot}`} />
            <span className="text-xs font-semibold text-slate-700">{BRIEF_STATUS_LABEL[status]}</span>
            <span className="text-[11px] font-medium text-slate-400 bg-white border border-slate-200 rounded-full px-1.5 leading-5 min-w-[20px] text-center">{briefs.length}</span>
          </div>
          {isAdmin && (
            <button onClick={onCreateClick} className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-slate-600 hover:bg-white transition-all">
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div
        onDragOver={e => { e.preventDefault(); setIsOver(true) }}
        onDragLeave={() => setIsOver(false)}
        onDrop={e => { e.preventDefault(); setIsOver(false); onDrop(status) }}
        className={`flex-1 rounded-b-xl border border-t-0 border-slate-200 p-2 space-y-2 overflow-y-auto transition-colors ${
          isOver && draggingId ? 'bg-slate-100/70' : 'bg-slate-50/50'
        }`}
        style={{ maxHeight: 'calc(100vh - 280px)', minHeight: 80 }}
      >
        {briefs.map(b => (
          <BriefCard key={b.id} brief={b} onClick={() => onCardClick(b)} onDragStart={onCardDragStart} />
        ))}
        {briefs.length === 0 && !isOver && (
          <div className="flex items-center justify-center py-6"><p className="text-xs text-slate-300">Sin briefs</p></div>
        )}
        {isOver && draggingId && (
          <div className={`border-2 border-dashed rounded-xl h-16 flex items-center justify-center opacity-50 ${accent.border.replace('border-l-', 'border-')}`}>
            <p className="text-xs text-slate-400">Mover aquí</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  initialBriefs: ContentBrief[]
  users: User[]
  isAdmin: boolean
  currentUserId: string
  selectedClientId: string
}

export function BriefPipeline({ initialBriefs, users, isAdmin, currentUserId, selectedClientId }: Props) {
  const router  = useRouter()
  const confirm = useConfirm()
  const [briefs, setBriefs]             = useState(initialBriefs)
  const [selectedBrief, setSelectedBrief] = useState<ContentBrief | null>(null)
  const [view, setView]                 = useState<'pipeline' | 'list'>('pipeline')
  const [filterStatus, setFilterStatus] = useState<BriefStatus | ''>('')
  const [draggingId, setDraggingId]     = useState<string | null>(null)
  const [updatingIds, setUpdatingIds]   = useState<Set<string>>(new Set())

  const filtered = briefs.filter(b => {
    if (filterStatus && b.status !== filterStatus) return false
    return true
  })

  const byStatus = (status: BriefStatus) => filtered.filter(b => b.status === status)

  async function handleDrop(targetStatus: BriefStatus) {
    if (!draggingId) return
    const brief = briefs.find(b => b.id === draggingId)
    if (!brief || brief.status === targetStatus) { setDraggingId(null); return }
    setBriefs(prev => prev.map(b => b.id === draggingId ? { ...b, status: targetStatus } : b))
    setDraggingId(null)
    try {
      const updated = await api.patch<ContentBrief>(`/api/briefs/${draggingId}/status`, { status: targetStatus })
      setBriefs(prev => prev.map(b => b.id === updated.id ? updated : b))
    } catch {
      setBriefs(prev => prev.map(b => b.id === brief.id ? brief : b))
    }
  }

  async function handleListStatusChange(briefId: string, newStatus: BriefStatus) {
    setUpdatingIds(prev => new Set(prev).add(briefId))
    try {
      const updated = await api.patch<ContentBrief>(`/api/briefs/${briefId}/status`, { status: newStatus })
      setBriefs(prev => prev.map(b => b.id === updated.id ? updated : b))
    } catch { /* ignore */ } finally {
      setUpdatingIds(prev => { const s = new Set(prev); s.delete(briefId); return s })
    }
  }

  async function handleDelete(briefId: string) {
    const ok = await confirm({
      title: 'Eliminar brief',
      message: '¿Eliminar este brief permanentemente? Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    await api.delete(`/api/briefs/${briefId}`)
    setBriefs(prev => prev.filter(b => b.id !== briefId))
    setSelectedBrief(null)
  }

  const refreshBrief = useCallback((updated: ContentBrief) => {
    setBriefs(prev => prev.map(b => b.id === updated.id ? updated : b))
    setSelectedBrief(updated)
  }, [])

  const addBrief = useCallback((brief: ContentBrief) => {
    setBriefs(prev => [brief, ...prev])
    setSelectedBrief(brief)
  }, [])

  const deleteBrief = useCallback((id: string) => {
    setBriefs(prev => prev.filter(b => b.id !== id))
    setSelectedBrief(null)
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as BriefStatus | '')}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#17394f]/20"
        >
          <option value="">Todos los estados</option>
          {ALL_BRIEF_STATUSES.map(s => <option key={s} value={s}>{BRIEF_STATUS_LABEL[s]}</option>)}
        </select>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl ml-auto">
          <button
            onClick={() => setView('pipeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'pipeline' ? 'bg-[#17394f] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />Pipeline
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'list' ? 'bg-[#17394f] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <List className="w-3.5 h-3.5" />Lista
          </button>
        </div>

        {isAdmin && (
          <button
            onClick={() => router.push(`/content/briefs/new?clientId=${selectedClientId}`)}
            className="flex items-center gap-1.5 bg-[#17394f] hover:bg-[#17394f]/90 text-white text-sm font-medium rounded-lg px-3 py-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo brief
          </button>
        )}
      </div>

      {/* ── Stats strip (pipeline only) ── */}
      {view === 'pipeline' && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {PIPELINE_STATUSES.map(status => {
            const count = byStatus(status).length
            const accent = STATUS_ACCENT[status]
            return (
              <div key={status} className="flex items-center gap-1.5 shrink-0 text-[11px] text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                <span>{BRIEF_STATUS_LABEL[status]}</span>
                <span className="font-semibold text-slate-700">{count}</span>
              </div>
            )
          })}
          <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 ml-auto">
            Total: {filtered.length}
          </div>
        </div>
      )}

      {/* ── Pipeline view ── */}
      {view === 'pipeline' && (
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1" onDragEnd={() => setDraggingId(null)}>
          {PIPELINE_STATUSES.map(status => (
            <PipelineColumn
              key={status}
              status={status}
              briefs={byStatus(status)}
              isAdmin={isAdmin}
              draggingId={draggingId}
              onCardClick={b => setSelectedBrief(b)}
              onCardDragStart={id => setDraggingId(id)}
              onDrop={handleDrop}
              onCreateClick={() => router.push(`/content/briefs/new?clientId=${selectedClientId}&status=${status}`)}
            />
          ))}
        </div>
      )}

      {/* ── List view ── */}
      {view === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Brief</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Asignados</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Días</th>
                <th className="px-4 py-3 w-6" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const days = daysSince(b.updatedAt)
                const updating = updatingIds.has(b.id)
                return (
                  <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedBrief(b)}
                        className="flex items-center gap-2 text-left hover:text-[#17394f] transition-colors"
                      >
                        {b.isRecurring && <RefreshCw className="w-3 h-3 text-slate-400 shrink-0" />}
                        <span className="font-medium text-slate-800 truncate max-w-xs">{b.title}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {(() => { const bg = clientBgColor(b.clientId, b.client.color); return (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isLightColor(bg) ? 'text-slate-800' : 'text-white'}`}
                          style={{ backgroundColor: bg }}
                        >
                          {b.client.name}
                        </span>
                      )})()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-slate-600 text-xs">
                        <span>{CONTENT_TYPE_ICON[b.type]}</span>
                        <span>{CONTENT_TYPE_LABEL[b.type]}</span>
                      </span>
                    </td>

                    {/* ── Status dropdown ── */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {isAdmin ? (
                        <select
                          value={b.status}
                          disabled={updating}
                          onChange={e => handleListStatusChange(b.id, e.target.value as BriefStatus)}
                          className={`text-[11px] font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#17394f]/20 transition-opacity ${
                            updating ? 'opacity-50' : ''
                          } ${BRIEF_STATUS_COLOR[b.status]}`}
                        >
                          {ALL_BRIEF_STATUSES.map(s => (
                            <option key={s} value={s}>{BRIEF_STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${BRIEF_STATUS_COLOR[b.status]}`}>
                          {BRIEF_STATUS_LABEL[b.status]}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex -space-x-1">
                        {b.assignees.slice(0, 3).map(a => <Avatar key={a.id} name={a.user.name} />)}
                        {b.assignees.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-slate-200 ring-2 ring-white flex items-center justify-center text-[9px] text-slate-500">
                            +{b.assignees.length - 3}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs flex items-center gap-0.5 ${timerColor(days, b.status)}`}>
                        <Clock className="w-3 h-3" />
                        {days === 0 ? 'Hoy' : `${days}d`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && (
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(b.id) }}
                          className="text-slate-200 hover:text-red-400 transition-colors"
                          title="Eliminar brief"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-300 text-sm">Sin briefs que mostrar</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {selectedBrief && (
        <BriefModal
          brief={selectedBrief}
          users={users}
          clients={[]}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onUpdate={refreshBrief}
          onDelete={deleteBrief}
          onClose={() => setSelectedBrief(null)}
        />
      )}
    </div>
  )
}
