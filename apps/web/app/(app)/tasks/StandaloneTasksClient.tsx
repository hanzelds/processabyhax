'use client'

import { useState, useCallback, useMemo } from 'react'
import { Task, User } from '@/types'
import { TaskCard } from '@/components/ui/TaskCard'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { QuickTaskModal } from './QuickTaskModal'
import { StandaloneTasks, StandaloneMember } from './page'
import { api } from '@/lib/api'
import { Plus, LayoutGrid, List, ChevronDown } from 'lucide-react'

type ViewMode = 'kanban' | 'list'

interface Props {
  initialTasks: StandaloneTasks
  users: User[]
  isAdmin: boolean
  currentUser: { id: string; name: string; role: string }
}

function UserPicker({
  currentUser,
  members,
  selectedId,
  onChange,
}: {
  currentUser: { id: string; name: string; role: string }
  members: StandaloneMember[]
  selectedId: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const allOptions = [
    { id: currentUser.id, name: `${currentUser.name} (yo)`, role: currentUser.role },
    ...members.filter(m => m.id !== currentUser.id),
  ]
  const selected = allOptions.find(o => o.id === selectedId) ?? allOptions[0]
  const roleLabel = (r: string) => r === 'ADMIN' ? 'Admin' : r === 'LEAD' ? 'Lead' : 'Team'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-[#17394f]/10 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-[#17394f]">{selected.name.charAt(0)}</span>
        </div>
        <span className="font-medium truncate max-w-[140px]">{selected.name}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-20 min-w-[200px] py-1 overflow-hidden">
            {allOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => { onChange(opt.id); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors ${opt.id === selectedId ? 'bg-slate-50 font-medium text-[#17394f]' : 'text-slate-700'}`}
              >
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-slate-600">{opt.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate">{opt.name}</p>
                  <p className="text-[10px] text-slate-400">{roleLabel(opt.role)}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function StandaloneTasksClient({ initialTasks, users, isAdmin, currentUser }: Props) {
  const [tasks, setTasks]         = useState(initialTasks)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(initialTasks.viewUserId)
  const [view, setView]           = useState<ViewMode>('kanban')

  const isViewingOwn = selectedUserId === currentUser.id
  const canSeeOthers = isAdmin

  // Flat array for kanban — all statuses
  const allTasks = useMemo(() => [
    ...tasks.overdue,
    ...tasks.today,
    ...tasks.pending,
    ...tasks.completed,
  ], [tasks])

  const total = tasks.overdue.length + tasks.today.length + tasks.pending.length

  const switchUser = useCallback(async (uid: string) => {
    setSelectedUserId(uid)
    setLoading(true)
    try {
      const data = await api.get<StandaloneTasks>(`/api/tasks/standalone?viewUserId=${uid}`)
      setTasks(data)
    } catch { /* keep current */ } finally {
      setLoading(false)
    }
  }, [])

  function handleCreated(newTask: Task) {
    if (selectedUserId === currentUser.id) {
      setTasks(prev => ({ ...prev, pending: [newTask, ...prev.pending] }))
    }
    setShowModal(false)
  }

  function handleKanbanUpdate(updated: Task) {
    setTasks(prev => {
      const remove = (arr: Task[]) => arr.filter(t => t.id !== updated.id)
      const base = {
        overdue:   remove(prev.overdue),
        today:     remove(prev.today),
        pending:   remove(prev.pending),
        completed: remove(prev.completed),
        members:   prev.members,
        viewUserId: prev.viewUserId,
      }
      if (updated.status === 'COMPLETED') return { ...base, completed: [updated, ...base.completed] }
      return { ...base, pending: [updated, ...base.pending] }
    })
  }

  const viewingUser = selectedUserId === currentUser.id
    ? { name: 'mis tareas' }
    : tasks.members.find(m => m.id === selectedUserId) ?? { name: 'este usuario' }

  return (
    <div className={`p-4 sm:p-6 lg:p-8 ${view === 'kanban' ? 'max-w-[1400px]' : 'max-w-3xl'} mx-auto`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tareas personales</h1>
          <p className="text-slate-500 text-sm mt-1">
            {loading ? 'Cargando…' : total > 0
              ? `${total} tarea${total !== 1 ? 's' : ''} pendiente${total !== 1 ? 's' : ''}`
              : 'Sin tareas pendientes'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* User picker */}
          {canSeeOthers && tasks.members.length > 0 && (
            <UserPicker
              currentUser={currentUser}
              members={tasks.members}
              selectedId={selectedUserId}
              onChange={switchUser}
            />
          )}

          {/* View toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setView('kanban')}
              title="Vista Kanban"
              className={`p-2 transition-colors ${view === 'kanban' ? 'bg-[#17394f] text-white' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              title="Vista Lista"
              className={`p-2 transition-colors ${view === 'list' ? 'bg-[#17394f] text-white' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Nueva tarea */}
          {isViewingOwn && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-[#17394f] hover:bg-[#17394f]/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva tarea
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-[#17394f]/20 border-t-[#17394f] rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && allTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-2xl">✓</div>
          <p className="text-slate-700 font-medium">
            {isViewingOwn ? 'No tienes tareas personales' : `${viewingUser.name} no tiene tareas personales`}
          </p>
          {isViewingOwn && (
            <>
              <p className="text-slate-400 text-sm mt-1 mb-5">Crea tareas que no estén vinculadas a ningún proyecto</p>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-[#17394f] hover:bg-[#17394f]/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva tarea
              </button>
            </>
          )}
        </div>
      )}

      {/* Kanban view */}
      {!loading && allTasks.length > 0 && view === 'kanban' && (
        <KanbanBoard
          initialTasks={allTasks}
          isAdmin={isAdmin || isViewingOwn}
          users={users}
          onTasksChange={updated => {
            // reflect status changes back into section buckets
            updated.forEach(t => {
              const inAll = allTasks.find(a => a.id === t.id)
              if (inAll && inAll.status !== t.status) handleKanbanUpdate(t)
            })
          }}
        />
      )}

      {/* List view */}
      {!loading && allTasks.length > 0 && view === 'list' && (
        <div className="space-y-6">
          {tasks.overdue.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-red-500 mb-2">
                Atrasadas <span className="ml-1 opacity-60">{tasks.overdue.length}</span>
              </p>
              <div className="space-y-2">
                {tasks.overdue.map(t => <TaskCard key={t.id} task={t} overdue />)}
              </div>
            </section>
          )}
          {tasks.today.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-500 mb-2">
                Hoy <span className="ml-1 opacity-60">{tasks.today.length}</span>
              </p>
              <div className="space-y-2">
                {tasks.today.map(t => <TaskCard key={t.id} task={t} />)}
              </div>
            </section>
          )}
          {tasks.pending.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Pendientes <span className="ml-1 opacity-60">{tasks.pending.length}</span>
              </p>
              <div className="space-y-2">
                {tasks.pending.map(t => <TaskCard key={t.id} task={t} />)}
              </div>
            </section>
          )}
          {tasks.completed.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Completadas <span className="ml-1 opacity-60">{tasks.completed.length}</span>
              </p>
              <div className="space-y-2 opacity-60">
                {tasks.completed.slice(0, 10).map(t => <TaskCard key={t.id} task={t} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <QuickTaskModal
          users={users}
          isAdmin={isAdmin}
          currentUserId={currentUser.id}
          onCreated={handleCreated}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
