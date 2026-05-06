'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ContentBrief, Project, BriefRole } from '@/types'
import { api } from '@/lib/api'
import { X, Loader2, FolderOpen, CheckCircle2 } from 'lucide-react'

const ROLE_TASK: Record<string, string> = {
  editor:    'Producción',
  copy:      'Copy final',
  guionista: 'Revisión de guión',
}

interface Props {
  brief: ContentBrief
  onSuccess: (updated: ContentBrief) => void
  onCancel: () => void
}

export function ProductionStartModal({ brief, onSuccess, onCancel }: Props) {
  const [projects, setProjects]   = useState<Project[]>([])
  const [projectId, setProjectId] = useState(brief.projectId ?? '')
  const [dueDate, setDueDate]     = useState('')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    api.get<Project[]>(`/api/projects?clientId=${brief.clientId}&status=ACTIVE`)
      .then(p => {
        setProjects(p)
        if (!projectId && p.length === 1) setProjectId(p[0].id)
      })
      .catch(() => setError('No se pudieron cargar los proyectos'))
      .finally(() => setLoading(false))
  }, [brief.clientId])

  const previewTasks = brief.assignees
    .filter(a => ROLE_TASK[a.role])
    .map(a => ({ name: a.user.name, title: ROLE_TASK[a.role as BriefRole] }))

  async function handleConfirm() {
    if (!projectId) { setError('Selecciona un proyecto'); return }
    setSaving(true)
    setError('')
    try {
      const updated = await api.post<ContentBrief>(`/api/briefs/${brief.id}/start-production`, {
        projectId,
        dueDate: dueDate || null,
      })
      onSuccess(updated)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar producción')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9900] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">Iniciar producción</h2>
          <button onClick={onCancel} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Project selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Proyecto *
            </label>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando proyectos…
              </div>
            ) : projects.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">
                No hay proyectos activos para <strong>{brief.client.name}</strong>.
                Crea uno primero desde la sección de proyectos.
              </p>
            ) : (
              <div className="space-y-1.5">
                {projects.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProjectId(p.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors ${
                      projectId === p.id
                        ? 'border-[#17394f] bg-[#17394f]/5 text-[#17394f]'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <FolderOpen className="w-4 h-4 shrink-0" />
                    <span className="flex-1 font-medium">{p.name}</span>
                    {projectId === p.id && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Fecha límite de tareas (opcional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/30"
            />
          </div>

          {/* Preview of tasks to be created */}
          {previewTasks.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Tareas que se crearán ({previewTasks.length})
              </label>
              <div className="space-y-1.5">
                {previewTasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#17394f]/40 shrink-0" />
                    <span className="font-medium text-slate-700">{t.title}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-500">{t.name}</span>
                  </div>
                ))}
              </div>
              {brief.assignees.filter(a => !ROLE_TASK[a.role]).length > 0 && (
                <p className="text-[11px] text-slate-400 mt-1.5">
                  {brief.assignees.filter(a => !ROLE_TASK[a.role]).map(a => a.user.name).join(', ')} no generan tarea automática.
                </p>
              )}
            </div>
          )}

          {previewTasks.length === 0 && (
            <p className="text-xs text-slate-400 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              No hay asignados con rol de editor, copy o guionista. Puedes iniciar la producción sin tareas automáticas.
            </p>
          )}

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || loading || projects.length === 0 || !projectId}
              className="flex-1 py-2.5 rounded-xl bg-[#17394f] text-white text-sm font-semibold hover:bg-[#17394f]/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Iniciar producción
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
