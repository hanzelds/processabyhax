'use client'

import { useState, useCallback } from 'react'
import { ContentBrief, BriefStatus, Client, User } from '@/types'
import { BRIEF_STATUS_LABEL, BRIEF_STATUS_COLOR, ALL_BRIEF_STATUSES, CONTENT_TYPE_ICON, PLATFORM_LABEL, clientColor } from '@/lib/utils'
import { api } from '@/lib/api'
import { BriefModal } from './BriefModal'
import { Plus, Clock, ChevronRight } from 'lucide-react'

const PIPELINE_STATUSES: BriefStatus[] = [
  'idea','en_desarrollo','revision_interna','aprobacion_cliente',
  'aprobado','en_produccion','entregado',
]

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function Avatar({ name, size = 6 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`w-${size} h-${size} rounded-full bg-[#17394f] flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
      {initials}
    </div>
  )
}

function BriefCard({ brief, onClick }: { brief: ContentBrief; onClick: () => void }) {
  const days = daysSince(brief.updatedAt)
  const clientBg = clientColor(brief.clientId)

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-100 p-3 cursor-pointer hover:shadow-sm hover:border-slate-200 transition-all group"
    >
      {/* Client badge + type icon */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${clientBg}`}>
          {brief.client.name}
        </span>
        <span className="text-base" title={brief.type}>{CONTENT_TYPE_ICON[brief.type]}</span>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-slate-800 leading-snug mb-2 line-clamp-2">{brief.title}</p>

      {/* Platforms */}
      <div className="flex flex-wrap gap-1 mb-2">
        {brief.platforms.map(p => (
          <span key={p} className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
            {PLATFORM_LABEL[p]}
          </span>
        ))}
      </div>

      {/* Footer: assignees + days */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex -space-x-1">
          {brief.assignees.slice(0, 4).map(a => (
            <Avatar key={a.id} name={a.user.name} size={5} />
          ))}
          {brief.assignees.length > 4 && (
            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">
              +{brief.assignees.length - 4}
            </div>
          )}
        </div>
        <span className={`text-[10px] flex items-center gap-0.5 ${
          brief.status === 'aprobacion_cliente' && days > 3 ? 'text-orange-500 font-semibold' : 'text-slate-400'
        }`}>
          <Clock className="w-3 h-3" />
          {days === 0 ? 'Hoy' : `${days}d`}
        </span>
      </div>
    </div>
  )
}

interface Props {
  initialBriefs: ContentBrief[]
  clients: Client[]
  users: User[]
  isAdmin: boolean
}

export function BriefPipeline({ initialBriefs, clients, users, isAdmin }: Props) {
  const [briefs, setBriefs] = useState(initialBriefs)
  const [selectedBrief, setSelectedBrief] = useState<ContentBrief | null>(null)
  const [createStatus, setCreateStatus] = useState<BriefStatus | null>(null)
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline')
  const [filterClient, setFilterClient] = useState('')
  const [filterStatus, setFilterStatus] = useState<BriefStatus | ''>('')

  const filtered = briefs.filter(b => {
    if (filterClient && b.clientId !== filterClient) return false
    if (filterStatus && b.status !== filterStatus) return false
    return true
  })

  const byStatus = (status: BriefStatus) => filtered.filter(b => b.status === status)

  const refreshBrief = useCallback((updated: ContentBrief) => {
    setBriefs(prev => prev.map(b => b.id === updated.id ? updated : b))
    setSelectedBrief(updated)
  }, [])

  const addBrief = useCallback((brief: ContentBrief) => {
    setBriefs(prev => [brief, ...prev])
    setSelectedBrief(brief)
    setCreateStatus(null)
  }, [])

  const deleteBrief = useCallback((id: string) => {
    setBriefs(prev => prev.filter(b => b.id !== id))
    setSelectedBrief(null)
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#17394f]/20"
        >
          <option value="">Todos los clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as BriefStatus | '')}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#17394f]/20"
        >
          <option value="">Todos los estados</option>
          {ALL_BRIEF_STATUSES.map(s => <option key={s} value={s}>{BRIEF_STATUS_LABEL[s]}</option>)}
        </select>

        <div className="flex border border-slate-200 rounded-lg overflow-hidden ml-auto">
          {(['pipeline','list'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors capitalize ${
                view === v ? 'bg-[#17394f] text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {v === 'pipeline' ? 'Pipeline' : 'Lista'}
            </button>
          ))}
        </div>

        {isAdmin && (
          <button
            onClick={() => setCreateStatus('idea')}
            className="flex items-center gap-1.5 bg-[#17394f] hover:bg-[#17394f]/90 text-white text-sm font-medium rounded-lg px-3 py-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo brief
          </button>
        )}
      </div>

      {/* Pipeline view */}
      {view === 'pipeline' && (
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
          {PIPELINE_STATUSES.map(status => {
            const cols = byStatus(status)
            return (
              <div key={status} className="shrink-0 w-64 flex flex-col">
                {/* Column header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full inline-block ${BRIEF_STATUS_COLOR[status].replace(/bg-(\w+-\d+).*/, 'bg-$1')}`} />
                    <span className="text-xs font-semibold text-slate-600">{BRIEF_STATUS_LABEL[status]}</span>
                    <span className="text-xs text-slate-400 font-normal">({cols.length})</span>
                  </div>
                  {isAdmin && status === 'idea' && (
                    <button
                      onClick={() => setCreateStatus('idea')}
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[calc(100vh-260px)]">
                  {cols.map(brief => (
                    <BriefCard key={brief.id} brief={brief} onClick={() => setSelectedBrief(brief)} />
                  ))}
                  {cols.length === 0 && (
                    <div className="border-2 border-dashed border-slate-100 rounded-xl p-4 text-center">
                      <p className="text-xs text-slate-300">Sin briefs</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Brief</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Asignados</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} onClick={() => setSelectedBrief(b)} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{b.title}</td>
                  <td className="px-4 py-3 text-slate-500">{b.client.name}</td>
                  <td className="px-4 py-3">{CONTENT_TYPE_ICON[b.type]} {b.type}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BRIEF_STATUS_COLOR[b.status]}`}>
                      {BRIEF_STATUS_LABEL[b.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex -space-x-1">
                      {b.assignees.slice(0, 3).map(a => <Avatar key={a.id} name={a.user.name} size={6} />)}
                      {b.assignees.length > 3 && <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] text-slate-500">+{b.assignees.length - 3}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400"><ChevronRight className="w-4 h-4" /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Sin briefs</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Brief detail/edit modal */}
      {selectedBrief && (
        <BriefModal
          brief={selectedBrief}
          users={users}
          clients={clients}
          isAdmin={isAdmin}
          onUpdate={refreshBrief}
          onDelete={deleteBrief}
          onClose={() => setSelectedBrief(null)}
        />
      )}

      {/* Create modal */}
      {createStatus && (
        <BriefModal
          brief={null}
          defaultStatus={createStatus}
          users={users}
          clients={clients}
          isAdmin={isAdmin}
          onUpdate={() => {}}
          onDelete={() => {}}
          onCreate={addBrief}
          onClose={() => setCreateStatus(null)}
        />
      )}
    </div>
  )
}
