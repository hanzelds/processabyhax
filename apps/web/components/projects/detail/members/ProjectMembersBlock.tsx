'use client'

import { useState } from 'react'
import { ProjectMember, User } from '@/types'
import { formatDate } from '@/lib/utils'
import { api } from '@/lib/api'

function MemberRow({ member, isAdmin, onRemove, onRoleChange }: {
  member: ProjectMember
  isAdmin: boolean
  onRemove: (userId: string) => void
  onRoleChange: (userId: string, role: 'lead' | 'executor') => void
}) {
  const hasAlert = (member.overdueCount ?? 0) > 0 || (member.blockedCount ?? 0) > 0
  return (
    <div className="py-3.5 border-b border-slate-100 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0" style={{ background: '#17394f' }}>
            {member.user.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-slate-900">{member.user.name}</p>
              {member.roleInProject === 'lead' && (
                <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-medium">Lead</span>
              )}
            </div>
            <p className="text-xs text-slate-400">{member.user.area || 'Sin área'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(member.overdueCount ?? 0) > 0 && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">{member.overdueCount} atr.</span>}
          {(member.blockedCount ?? 0) > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">{member.blockedCount} bloq.</span>}
          {isAdmin && (
            <button onClick={() => onRemove(member.userId)} className="text-slate-300 hover:text-red-400 transition-colors text-sm leading-none" title="Remover del proyecto">✕</button>
          )}
        </div>
      </div>

      <div className="ml-10.5 mt-1.5 flex gap-4 text-xs text-slate-400">
        <span>{member.activeTasks ?? 0} activas</span>
        <span>{member.completedTasks ?? 0} completadas</span>
        {member.nextDue && <span>Próx: {formatDate(member.nextDue.dueDate)}</span>}
      </div>
    </div>
  )
}

interface Props {
  projectId: string
  initialMembers: ProjectMember[]
  users: User[]
  isAdmin: boolean
}

export function ProjectMembersBlock({ projectId, initialMembers, users, isAdmin }: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [showAdd, setShowAdd] = useState(false)
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState<'lead' | 'executor'>('executor')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const memberIds = new Set(members.map(m => m.userId))
  const available = users.filter(u => !memberIds.has(u.id))

  async function addMember() {
    if (!addUserId) return
    setSaving(true); setError('')
    try {
      const res = await api.post<ProjectMember>(`/api/projects/${projectId}/members`, { userId: addUserId, roleInProject: addRole })
      // re-fetch enriched members
      const enriched = await api.get<ProjectMember[]>(`/api/projects/${projectId}/members`)
      setMembers(enriched)
      setShowAdd(false); setAddUserId(''); setAddRole('executor')
    } catch (e: any) {
      setError(e?.message ?? 'Error al agregar miembro')
    } finally {
      setSaving(false)
    }
  }

  async function removeMember(userId: string) {
    await api.delete(`/api/projects/${projectId}/members/${userId}`)
    setMembers(prev => prev.filter(m => m.userId !== userId))
  }

  async function changeRole(userId: string, roleInProject: 'lead' | 'executor') {
    await api.patch(`/api/projects/${projectId}/members/${userId}`, { roleInProject })
    setMembers(prev => prev.map(m => m.userId === userId ? { ...m, roleInProject } : m))
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Equipo del proyecto</h3>
        {isAdmin && available.length > 0 && (
          <button onClick={() => setShowAdd(!showAdd)} className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors text-white" style={{ background: '#17394f' }}>
            + Agregar
          </button>
        )}
      </div>

      {showAdd && (
        <div className="mb-4 p-3 bg-slate-50 rounded-xl space-y-2">
          <select value={addUserId} onChange={e => setAddUserId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            <option value="">Selecciona un miembro</option>
            {available.map(u => <option key={u.id} value={u.id}>{u.name}{u.area ? ` · ${u.area}` : ''}</option>)}
          </select>
          <select value={addRole} onChange={e => setAddRole(e.target.value as 'lead' | 'executor')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
            <option value="executor">Executor</option>
            <option value="lead">Lead creativo</option>
          </select>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={addMember} disabled={!addUserId || saving} className="flex-1 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-60 transition-colors" style={{ background: '#17394f' }}>
              {saving ? 'Guardando…' : 'Confirmar'}
            </button>
            <button onClick={() => { setShowAdd(false); setError('') }} className="flex-1 py-1.5 text-sm text-slate-600 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {members.length === 0
        ? <p className="text-sm text-slate-400 py-4 text-center">Sin miembros asignados</p>
        : members.map(m => (
          <MemberRow key={m.userId} member={m} isAdmin={isAdmin} onRemove={removeMember} onRoleChange={changeRole} />
        ))
      }
    </div>
  )
}
