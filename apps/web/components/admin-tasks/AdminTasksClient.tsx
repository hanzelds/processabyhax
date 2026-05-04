'use client'

import { useState, useCallback } from 'react'
import { AdminTask, AdminTaskRecurrence, AdminTaskStatus, AdminTaskCategory } from '@/types'
import { api } from '@/lib/api'
import { CATEGORY_ICON, CATEGORY_LABEL, FREQUENCY_LABEL } from '@/lib/adminTasks'
import { AdminTaskCard } from './AdminTaskCard'
import { AdminTaskForm } from './AdminTaskForm'
import { AdminTaskDetailPanel } from './AdminTaskDetailPanel'
import { RecurrenceForm } from './RecurrenceForm'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import {
  Plus, RefreshCw, Clock, CheckCircle2, Ban,
  Repeat2, ChevronRight, Pencil, Pause, Play, Trash2,
} from 'lucide-react'

type Tab = 'board' | 'completed' | 'recurrences'

const PRIORITY_ORDER: Record<string, number> = { URGENTE: 0, ALTA: 1, NORMAL: 2, BAJA: 3 }

const COLUMNS: { status: AdminTaskStatus; label: string; color: string; bg: string; dot: string }[] = [
  { status: 'PENDIENTE',   label: 'Pendiente',   color: 'text-slate-700',  bg: 'bg-slate-100',  dot: 'bg-slate-400'  },
  { status: 'EN_PROGRESO', label: 'En progreso', color: 'text-blue-700',   bg: 'bg-blue-100',   dot: 'bg-blue-500'   },
  { status: 'BLOQUEADA',   label: 'Bloqueada',   color: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
]

interface Props {
  initialTasks: AdminTask[]
  initialRecurrences: AdminTaskRecurrence[]
}

export function AdminTasksClient({ initialTasks, initialRecurrences }: Props) {
  const toast   = useToast()
  const confirm = useConfirm()

  const [tab, setTab] = useState<Tab>('board')
  const [tasks, setTasks] = useState<AdminTask[]>(initialTasks)
  const [recurrences, setRecurrences] = useState<AdminTaskRecurrence[]>(initialRecurrences)
  const [loading, setLoading] = useState(false)
  const [filterCategory, setFilterCategory] = useState<AdminTaskCategory | ''>('')

  // Panels
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<AdminTask | null>(null)
  const [detailTask, setDetailTask]   = useState<AdminTask | null>(null)
  const [showRecurrenceForm, setShowRecurrenceForm] = useState(false)
  const [editingRecurrence, setEditingRecurrence]   = useState<AdminTaskRecurrence | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [t, r] = await Promise.all([
        api.get<AdminTask[]>('/api/admin/tasks?tab=all'),
        api.get<AdminTaskRecurrence[]>('/api/admin/tasks/recurrences'),
      ])
      setTasks(t)
      setRecurrences(r)
    } catch { toast.error('Error al recargar') }
    finally { setLoading(false) }
  }, [toast])

  async function handleStatusChange(id: string, status: AdminTaskStatus) {
    try {
      const updated = await api.patch<AdminTask>(`/api/admin/tasks/${id}/status`, { status })
      setTasks(prev => prev.map(t => t.id === id ? updated : t))
      if (detailTask?.id === id) setDetailTask(updated)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error al cambiar estado') }
  }

  async function handleComplete(task: AdminTask, notes: string) {
    try {
      const updated = await api.patch<AdminTask>(`/api/admin/tasks/${task.id}/complete`, { resolutionNotes: notes || null })
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
      setDetailTask(null)
      toast.success('Tarea completada')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error al completar') }
  }

  async function handleCancel(task: AdminTask) {
    const ok = await confirm({ title: 'Cancelar tarea', message: `¿Cancelar "${task.title}"?`, confirmLabel: 'Cancelar tarea', danger: true })
    if (!ok) return
    try {
      const updated = await api.patch<AdminTask>(`/api/admin/tasks/${task.id}/status`, { status: 'CANCELADA' })
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
      setDetailTask(null)
      toast.success('Tarea cancelada')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error al cancelar') }
  }

  async function handleToggleRecurrence(id: string) {
    try {
      const updated = await api.patch<AdminTaskRecurrence>(`/api/admin/tasks/recurrences/${id}/toggle`, {})
      setRecurrences(prev => prev.map(r => r.id === id ? updated : r))
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  async function handleDeleteRecurrence(id: string) {
    const ok = await confirm({ title: 'Eliminar recurrencia', message: 'Las tareas ya creadas se conservan.', confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    try {
      await api.delete(`/api/admin/tasks/recurrences/${id}`)
      setRecurrences(prev => prev.filter(r => r.id !== id))
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  // Derived data
  const openTasks  = tasks.filter(t => !['COMPLETADA', 'CANCELADA'].includes(t.status))
  const closedTasks = tasks.filter(t => ['COMPLETADA', 'CANCELADA'].includes(t.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const filteredOpen = filterCategory ? openTasks.filter(t => t.category === filterCategory) : openTasks

  function tasksForColumn(status: AdminTaskStatus) {
    return filteredOpen
      .filter(t => t.status === status)
      .sort((a, b) => {
        const urgA = a.isOverdue ? 0 : a.isDueSoon ? 1 : 2
        const urgB = b.isOverdue ? 0 : b.isDueSoon ? 1 : 2
        if (urgA !== urgB) return urgA - urgB
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      })
  }

  const hasFilters = !!filterCategory

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 bg-white border-b border-slate-100 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tareas Administrativas</h1>
          <p className="text-sm text-slate-400 mt-0.5">Backlog operativo interno de dirección</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { setEditingTask(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white font-medium bg-[#17394f] hover:bg-[#17394f]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva tarea
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 px-6 pt-4 bg-white border-b border-slate-100 shrink-0">
        {([
          { id: 'board' as Tab, label: 'Tablero', count: openTasks.length },
          { id: 'completed' as Tab, label: 'Historial', count: closedTasks.length },
          { id: 'recurrences' as Tab, label: 'Recurrentes', count: recurrences.length },
        ] as { id: Tab; label: string; count: number }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-[#17394f] text-[#17394f]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                tab === t.id ? 'bg-[#17394f]/10 text-[#17394f]' : 'bg-slate-100 text-slate-500'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">

        {/* Board tab */}
        {tab === 'board' && (
          <div className="flex flex-col h-full">
            {/* Category filter pills */}
            <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-slate-100 overflow-x-auto shrink-0">
              <button
                onClick={() => setFilterCategory('')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  !filterCategory ? 'bg-[#17394f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todas
              </button>
              {(Object.keys(CATEGORY_LABEL) as AdminTaskCategory[]).map(cat => {
                const count = openTasks.filter(t => t.category === cat).length
                if (count === 0) return null
                return (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      filterCategory === cat
                        ? 'bg-[#17394f] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {CATEGORY_ICON[cat]} {CATEGORY_LABEL[cat]}
                    <span className={`ml-0.5 ${filterCategory === cat ? 'opacity-70' : 'text-slate-400'}`}>{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Kanban columns */}
            <div className="flex-1 overflow-auto px-6 py-5">
              {openTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                  <CheckCircle2 className="w-12 h-12 mb-3" />
                  <p className="text-sm font-medium text-slate-400">No hay tareas activas</p>
                  <p className="text-xs text-slate-300 mt-1">¡Todo al día por ahora!</p>
                </div>
              ) : hasFilters && filteredOpen.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                  <p className="text-sm text-slate-400">Sin tareas en esta categoría</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-w-0">
                  {COLUMNS.map(col => {
                    const colTasks = tasksForColumn(col.status)
                    return (
                      <div key={col.status} className="flex flex-col min-w-0">
                        {/* Column header */}
                        <div className="flex items-center gap-2 mb-3 px-1">
                          <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                          <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${col.bg} ${col.color}`}>
                            {colTasks.length}
                          </span>
                        </div>

                        {/* Cards */}
                        <div className="space-y-2.5">
                          {colTasks.map(task => (
                            <AdminTaskCard
                              key={task.id}
                              task={task}
                              onClick={() => setDetailTask(task)}
                              onStatusChange={handleStatusChange}
                            />
                          ))}
                          {colTasks.length === 0 && (
                            <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center">
                              <p className="text-xs text-slate-300">Sin tareas</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Historial (completed/cancelled) tab */}
        {tab === 'completed' && (
          <div className="overflow-auto h-full px-6 py-5">
            {closedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                <Clock className="w-10 h-10 mb-3" />
                <p className="text-sm text-slate-400">Sin historial aún</p>
              </div>
            ) : (
              <div className="max-w-3xl space-y-2">
                {closedTasks.map(task => (
                  <button
                    key={task.id}
                    onClick={() => setDetailTask(task)}
                    className="w-full flex items-center gap-4 bg-white rounded-xl border border-slate-100 px-4 py-3 hover:border-slate-300 hover:shadow-sm transition-all text-left group"
                  >
                    {task.status === 'COMPLETADA'
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      : <Ban className="w-4 h-4 text-slate-300 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${task.status === 'CANCELADA' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {task.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {CATEGORY_ICON[task.category]} {CATEGORY_LABEL[task.category]}
                        {task.completedAt && ` · ${new Date(task.completedAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </p>
                    </div>
                    {task.resolutionNotes && (
                      <span className="text-xs text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full shrink-0">
                        Con notas
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recurrences tab */}
        {tab === 'recurrences' && (
          <div className="overflow-auto h-full px-6 py-5">
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">{recurrences.length} regla(s) de recurrencia</p>
                <button
                  onClick={() => { setEditingRecurrence(null); setShowRecurrenceForm(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#17394f] font-medium hover:bg-[#17394f]/5 border border-[#17394f]/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nueva regla
                </button>
              </div>

              {recurrences.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                  <Repeat2 className="w-10 h-10 mb-3" />
                  <p className="text-sm text-slate-400">Sin reglas de recurrencia</p>
                  <p className="text-xs text-slate-300 mt-1">Las tareas recurrentes se generan automáticamente</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recurrences.map(rec => (
                    <div
                      key={rec.id}
                      className={`bg-white rounded-xl border border-slate-100 overflow-hidden transition-opacity ${!rec.isActive ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-4 px-5 py-4">
                        {/* Icon */}
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-lg shrink-0">
                          {CATEGORY_ICON[rec.category]}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800 text-sm">{rec.title}</span>
                            <span className="text-xs bg-[#17394f]/8 text-[#17394f] px-2 py-0.5 rounded-full font-medium">
                              {FREQUENCY_LABEL[rec.frequency]}
                            </span>
                            {!rec.isActive && (
                              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Pausada</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                            <span>{CATEGORY_LABEL[rec.category]}</span>
                            {rec.advanceDays > 0 && <span>{rec.advanceDays} días anticipación</span>}
                            {rec.nextGenerationAt && (
                              <span>
                                Próxima: {new Date(rec.nextGenerationAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                            <span>{rec._count?.tasks ?? 0} instancia(s)</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setEditingRecurrence(rec); setShowRecurrenceForm(true) }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleRecurrence(rec.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title={rec.isActive ? 'Pausar' : 'Activar'}
                          >
                            {rec.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteRecurrence(rec.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals & panels ── */}
      {showForm && (
        <AdminTaskForm
          task={editingTask ?? undefined}
          onClose={() => { setShowForm(false); setEditingTask(null) }}
          onSaved={saved => {
            setShowForm(false)
            setEditingTask(null)
            setTasks(prev => {
              const idx = prev.findIndex(t => t.id === saved.id)
              return idx >= 0 ? prev.map(t => t.id === saved.id ? saved : t) : [saved, ...prev]
            })
          }}
        />
      )}

      {showRecurrenceForm && (
        <RecurrenceForm
          recurrence={editingRecurrence ?? undefined}
          onClose={() => { setShowRecurrenceForm(false); setEditingRecurrence(null) }}
          onSaved={saved => {
            setShowRecurrenceForm(false)
            setEditingRecurrence(null)
            setRecurrences(prev => {
              const idx = prev.findIndex(r => r.id === saved.id)
              return idx >= 0 ? prev.map(r => r.id === saved.id ? saved : r) : [saved, ...prev]
            })
          }}
        />
      )}

      {detailTask && (
        <AdminTaskDetailPanel
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onStatusChange={handleStatusChange}
          onComplete={handleComplete}
          onCancel={handleCancel}
          onEdit={task => { setDetailTask(null); setEditingTask(task); setShowForm(true) }}
          onTaskUpdated={updated => {
            setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
            setDetailTask(updated)
          }}
        />
      )}
    </div>
  )
}
