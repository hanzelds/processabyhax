'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Project, DeadlineStatus } from '@/types'
import { formatDate, PROJECT_STATUS_LABEL, PROJECT_STATUS_COLOR } from '@/lib/utils'
import { api } from '@/lib/api'
import { LockOpen, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

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
  const router = useRouter()
  const toast  = useToast()
  const [editing, setEditing]   = useState(false)
  const [name, setName]         = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [status, setStatus]     = useState(project.status)
  const [estimatedClose, setEstimatedClose] = useState(project.estimatedClose?.slice(0, 10) ?? '')
  const [saving, setSaving]     = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

  async function save() {
    setSaving(true)
    try {
      const updated = await api.patch<Project>(`/api/projects/${project.id}`, { name, description, status, estimatedClose: estimatedClose || null })
      onUpdate(updated)
      setEditing(false)
    } finally { setSaving(false) }
  }

  async function unlock() {
    setUnlocking(true)
    try {
      const updated = await api.patch<Project>(`/api/projects/${project.id}/unlock`, {})
      onUpdate(updated)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al reabrir')
    } finally { setUnlocking(false) }
  }

  async function deleteProject() {
    if (deleteInput !== project.name) return
    setDeleting(true)
    try {
      await api.delete(`/api/projects/${project.id}`)
      router.push('/projects')
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar')
      setDeleting(false)
    }
  }

  const dl = project.deadlineStatus ?? 'no_date'
  const isCompleted = project.status === 'COMPLETED'

  return (
    <>
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Información general</h3>
        {isAdmin && !editing && (
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
            <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 mt-2">✓ Proyecto completado</p>
          )}
        </dl>
      )}

      {/* Admin actions */}
      {isAdmin && !editing && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
          {isCompleted && (
            <button
              onClick={unlock}
              disabled={unlocking}
              className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              {unlocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LockOpen className="w-3.5 h-3.5" />}
              {unlocking ? 'Reabriendo…' : 'Reabrir proyecto'}
            </button>
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar proyecto
          </button>
        </div>
      )}
    </div>

    {/* Delete confirmation modal */}
    {confirmDelete && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={() => { setConfirmDelete(false); setDeleteInput('') }}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Eliminar proyecto</h3>
              <p className="text-xs text-slate-500">Esta acción no se puede deshacer</p>
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-1">
            Se eliminarán permanentemente todas las tareas, archivos e historial del proyecto <strong>"{project.name}"</strong>.
          </p>
          <p className="text-sm text-slate-600 mb-4">
            Escribe el nombre del proyecto para confirmar:
          </p>

          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300"
            placeholder={project.name}
            value={deleteInput}
            onChange={e => setDeleteInput(e.target.value)}
            autoFocus
          />

          <div className="flex gap-2">
            <button
              onClick={deleteProject}
              disabled={deleting || deleteInput !== project.name}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-40"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              {deleting ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button
              onClick={() => { setConfirmDelete(false); setDeleteInput('') }}
              className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
