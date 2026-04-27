'use client'

import { useState } from 'react'
import { Project, DeadlineStatus } from '@/types'
import { formatDate, PROJECT_STATUS_LABEL, PROJECT_STATUS_COLOR } from '@/lib/utils'
import { api } from '@/lib/api'

const DEADLINE_CLS: Record<DeadlineStatus, string> = {
  on_track: 'text-emerald-600',
  urgent:   'text-amber-600',
  overdue:  'text-red-600',
  no_date:  'text-slate-400',
}

interface Props {
  project: Project
  isAdmin: boolean
  onUpdate: (updated: Project) => void
}

export function ProjectInfoBlock({ project, isAdmin, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName]               = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [status, setStatus]           = useState(project.status)
  const [estimatedClose, setEstimatedClose] = useState(project.estimatedClose?.slice(0, 10) ?? '')
  const [saving, setSaving]           = useState(false)

  async function save() {
    setSaving(true)
    try {
      const updated = await api.patch<Project>(`/api/projects/${project.id}`, { name, description, status, estimatedClose: estimatedClose || null })
      onUpdate(updated)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const dl = project.deadlineStatus ?? 'no_date'
  const isCompleted = project.status === 'COMPLETED'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Información general</h3>
        {isAdmin && !isCompleted && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-brand-700 hover:text-brand-800 font-medium transition-colors">Editar</button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Descripción</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Estado</label>
              <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="ACTIVE">Activo</option>
                <option value="IN_PROGRESS">En progreso</option>
                <option value="COMPLETED">Completado</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Cierre estimado</label>
              <input type="date" value={estimatedClose} onChange={e => setEstimatedClose(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving || !name} className="flex-1 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 transition-colors" style={{ background: '#17394f' }}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button onClick={() => { setEditing(false); setName(project.name); setDescription(project.description ?? '') }} className="flex-1 py-2 text-sm text-slate-600 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Cliente</dt>
            <dd className="font-medium text-slate-900 text-right">{project.client?.name ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Estado</dt>
            <dd>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROJECT_STATUS_COLOR[project.status]}`}>
                {PROJECT_STATUS_LABEL[project.status]}
              </span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Inicio</dt>
            <dd className="text-slate-700">{formatDate(project.startDate)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Cierre estimado</dt>
            <dd className={`font-medium ${DEADLINE_CLS[dl]}`}>
              {project.estimatedClose ? formatDate(project.estimatedClose) : '—'}
            </dd>
          </div>
          {project.closedAt && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Cerrado</dt>
              <dd className="text-emerald-600 font-medium">{formatDate(project.closedAt)}</dd>
            </div>
          )}
          {project.description && (
            <div className="pt-2 border-t border-slate-100">
              <dt className="text-slate-500 mb-1">Descripción</dt>
              <dd className="text-slate-700 text-sm whitespace-pre-wrap">{project.description}</dd>
            </div>
          )}
          {isCompleted && (
            <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 mt-2">✓ Proyecto completado — solo lectura</p>
          )}
        </dl>
      )}
    </div>
  )
}
