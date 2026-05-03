'use client'

import { useEffect, useState, useCallback } from 'react'
import { AdminTask, AdminTaskStatus, AdminTaskCategory, AdminTaskPriority, AdminTaskRecurrence } from '@/types'
import { api } from '@/lib/api'
import {
  CATEGORY_ICON, CATEGORY_LABEL,
  PRIORITY_LABEL, PRIORITY_COLOR,
  STATUS_LABEL, STATUS_COLOR,
  FREQUENCY_LABEL,
} from '@/lib/adminTasks'
import { AdminTaskCard } from '@/components/admin-tasks/AdminTaskCard'
import { AdminTaskForm } from '@/components/admin-tasks/AdminTaskForm'
import { CompleteTaskModal } from '@/components/admin-tasks/CompleteTaskModal'
import { RecurrenceForm } from '@/components/admin-tasks/RecurrenceForm'
import { useConfirm } from '@/components/ui/ConfirmDialog'

type Tab = 'all' | 'pending' | 'recurrences' | 'completed'

const PRIORITY_ORDER: Record<AdminTaskPriority, number> = { URGENTE: 0, ALTA: 1, NORMAL: 2, BAJA: 3 }
const CATEGORY_ORDER: Record<AdminTaskCategory, number> = {
  FINANZAS: 0, INFRAESTRUCTURA: 1, LEGAL_CONTRATOS: 2, EQUIPO: 3, ESTRATEGIA: 4, OPERACIONES: 5, OTRO: 6,
}

export default function AdminTasksPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('all')
  const [tasks, setTasks] = useState<AdminTask[]>([])
  const [recurrences, setRecurrences] = useState<AdminTaskRecurrence[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState<AdminTaskCategory | ''>('')
  const [filterPriority, setFilterPriority] = useState<AdminTaskPriority | ''>('')

  // Modals
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<AdminTask | null>(null)
  const [completingTask, setCompletingTask] = useState<AdminTask | null>(null)
  const [showRecurrenceForm, setShowRecurrenceForm] = useState(false)
  const [editingRecurrence, setEditingRecurrence] = useState<AdminTaskRecurrence | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'recurrences') {
        const data = await api.get<AdminTaskRecurrence[]>('/api/admin/tasks/recurrences')
        setRecurrences(data)
      } else {
        const params = new URLSearchParams()
        params.set('tab', tab)
        if (filterCategory) params.set('category', filterCategory)
        if (filterPriority) params.set('priority', filterPriority)
        const data = await api.get<AdminTask[]>(`/api/admin/tasks?${params}`)
        setTasks(data)
      }
    } finally {
      setLoading(false)
    }
  }, [tab, filterCategory, filterPriority])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function handleStatusChange(id: string, status: AdminTaskStatus) {
    const updated = await api.patch<AdminTask>(`/api/admin/tasks/${id}/status`, { status })
    setTasks(prev => prev.map(t => t.id === id ? updated : t).filter(t =>
      tab === 'all' ? !['COMPLETADA', 'CANCELADA'].includes(t.status) :
      tab === 'pending' ? ['PENDIENTE', 'BLOQUEADA'].includes(t.status) : true
    ))
  }

  async function handleToggleRecurrence(id: string) {
    const updated = await api.patch<AdminTaskRecurrence>(`/api/admin/tasks/recurrences/${id}/toggle`, {})
    setRecurrences(prev => prev.map(r => r.id === id ? updated : r))
  }

  async function handleDeleteRecurrence(id: string) {
    const ok = await confirm({
      title: 'Eliminar recurrencia',
      message: '¿Eliminar esta recurrencia? Las tareas ya creadas se conservan.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    await api.delete(`/api/admin/tasks/recurrences/${id}`)
    setRecurrences(prev => prev.filter(r => r.id !== id))
  }

  // Group tasks by category (for "all" tab)
  const groupedTasks = () => {
    const groups: Partial<Record<AdminTaskCategory, AdminTask[]>> = {}
    const sorted = [...tasks].sort((a, b) => {
      const urgA = a.isOverdue ? -1 : a.isDueSoon ? 0 : 1
      const urgB = b.isOverdue ? -1 : b.isDueSoon ? 0 : 1
      if (urgA !== urgB) return urgA - urgB
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    })
    for (const t of sorted) {
      if (!groups[t.category]) groups[t.category] = []
      groups[t.category]!.push(t)
    }
    // Sort categories: ones with urgent/overdue tasks first
    return Object.entries(groups).sort(([catA, tasksA], [catB, tasksB]) => {
      const urgA = tasksA!.some(t => t.isOverdue || t.isDueSoon) ? 0 : 1
      const urgB = tasksB!.some(t => t.isOverdue || t.isDueSoon) ? 0 : 1
      if (urgA !== urgB) return urgA - urgB
      return CATEGORY_ORDER[catA as AdminTaskCategory] - CATEGORY_ORDER[catB as AdminTaskCategory]
    }) as [AdminTaskCategory, AdminTask[]][]
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'pending', label: 'Pendientes' },
    { id: 'recurrences', label: 'Recurrentes' },
    { id: 'completed', label: 'Completadas' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Tareas Administrativas</h1>
          <p className="text-xs text-slate-400 mt-0.5">Backlog operativo interno de dirección</p>
        </div>
        <button
          onClick={() => { setEditingTask(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium transition-colors hover:opacity-90"
          style={{ background: '#17394f' }}
        >
          + Nueva tarea
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-3 pb-0 shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors font-medium ${
              tab === t.id
                ? 'bg-white text-slate-800 border border-b-0 border-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 border-t border-slate-200">
        {/* Filters (not for recurrences/completed) */}
        {tab !== 'recurrences' && tab !== 'completed' && (
          <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 bg-white">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as AdminTaskCategory | '')}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <option value="">Todas las categorías</option>
              {(['EQUIPO','FINANZAS','LEGAL_CONTRATOS','INFRAESTRUCTURA','ESTRATEGIA','OPERACIONES','OTRO'] as AdminTaskCategory[]).map(c => (
                <option key={c} value={c}>{CATEGORY_ICON[c]} {CATEGORY_LABEL[c]}</option>
              ))}
            </select>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value as AdminTaskPriority | '')}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <option value="">Toda prioridad</option>
              {(['URGENTE','ALTA','NORMAL','BAJA'] as AdminTaskPriority[]).map(p => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
            {(filterCategory || filterPriority) && (
              <button
                onClick={() => { setFilterCategory(''); setFilterPriority('') }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                × Limpiar
              </button>
            )}
          </div>
        )}

        <div className="px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Cargando…</div>
          ) : tab === 'recurrences' ? (
            /* ── Recurrences tab ── */
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500">{recurrences.length} recurrencia(s) configurada(s)</p>
                <button
                  onClick={() => { setEditingRecurrence(null); setShowRecurrenceForm(true) }}
                  className="text-sm text-brand-700 hover:text-brand-900 font-medium"
                >
                  + Nueva recurrencia
                </button>
              </div>
              {recurrences.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">No hay recurrencias configuradas</div>
              ) : recurrences.map(rec => (
                <div key={rec.id} className={`bg-white rounded-xl border border-slate-100 p-4 shadow-sm ${!rec.isActive ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{CATEGORY_ICON[rec.category]}</span>
                        <span className="text-xs text-slate-400">{CATEGORY_LABEL[rec.category]}</span>
                        <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">
                          {FREQUENCY_LABEL[rec.frequency]}
                        </span>
                        {!rec.isActive && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Pausada</span>
                        )}
                      </div>
                      <p className="font-medium text-slate-800 text-sm">{rec.title}</p>
                      {rec.advanceDays > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">{rec.advanceDays} días de anticipación</p>
                      )}
                      {rec.nextGenerationAt && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Próxima generación: {new Date(rec.nextGenerationAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">{rec._count?.tasks ?? 0} instancia(s) creada(s)</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setEditingRecurrence(rec); setShowRecurrenceForm(true) }}
                        className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggleRecurrence(rec.id)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${rec.isActive ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}`}
                      >
                        {rec.isActive ? 'Pausar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => handleDeleteRecurrence(rec.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : tab === 'all' ? (
            /* ── All tasks tab (grouped by category) ── */
            tasks.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">No hay tareas activas</div>
            ) : (
              <div className="space-y-6">
                {groupedTasks().map(([cat, catTasks]) => (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">{CATEGORY_ICON[cat]}</span>
                      <span className="font-medium text-slate-700 text-sm">{CATEGORY_LABEL[cat]}</span>
                      <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">{catTasks.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {catTasks.map(task => (
                        <AdminTaskCard
                          key={task.id}
                          task={task}
                          onStatusChange={handleStatusChange}
                          onComplete={t => setCompletingTask(t)}
                          onEdit={t => { setEditingTask(t); setShowForm(true) }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* ── Pending / Completed tabs (flat list) ── */
            tasks.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                {tab === 'pending' ? 'No hay tareas pendientes' : 'Sin historial de tareas completadas'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tasks.map(task => (
                  <AdminTaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onComplete={t => setCompletingTask(t)}
                    onEdit={t => { setEditingTask(t); setShowForm(true) }}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Modals */}
      {showForm && (
        <AdminTaskForm
          task={editingTask ?? undefined}
          onClose={() => { setShowForm(false); setEditingTask(null) }}
          onSaved={saved => {
            setShowForm(false)
            setEditingTask(null)
            fetchTasks()
          }}
        />
      )}

      {completingTask && (
        <CompleteTaskModal
          task={completingTask}
          onClose={() => setCompletingTask(null)}
          onCompleted={completed => {
            setCompletingTask(null)
            setTasks(prev => prev.filter(t => t.id !== completed.id))
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
            fetchTasks()
          }}
        />
      )}
    </div>
  )
}
