'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { Task, TaskStatus, User } from '@/types'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { api } from '@/lib/api'
import { TASK_TYPE_COLOR, TASK_TYPE_LABEL } from '@/lib/utils'

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'PENDING',     label: 'Pendiente',    color: 'border-slate-200' },
  { id: 'IN_PROGRESS', label: 'En progreso',  color: 'border-blue-200' },
  { id: 'IN_REVIEW',   label: 'En revisión',  color: 'border-amber-200' },
  { id: 'COMPLETED',   label: 'Completado',   color: 'border-emerald-200' },
]

interface Props {
  initialTasks: Task[]
  projectId?: string
  isAdmin: boolean
  users?: User[]
  onTasksChange?: (tasks: Task[]) => void
}

export function KanbanBoard({ initialTasks, projectId, isAdmin, users = [], onTasksChange }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)

  // Merge new tasks added externally (e.g. bulk creation) without resetting drag state
  useEffect(() => {
    setTasks(prev => {
      const existingIds = new Set(prev.map(t => t.id))
      const incoming = initialTasks.filter(t => !existingIds.has(t.id))
      if (incoming.length === 0) return prev
      return [...prev, ...incoming]
    })
  }, [initialTasks]) // eslint-disable-line react-hooks/exhaustive-deps

  function syncTasks(updater: (prev: Task[]) => Task[]) {
    setTasks(prev => {
      const next = updater(prev)
      onTasksChange?.(next)
      return next
    })
  }
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const tasksByStatus = useCallback((status: TaskStatus) =>
    tasks.filter(t => t.status === status),
  [tasks])

  function onDragStart(event: DragStartEvent) {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const taskId = active.id as string
    const overId = over.id as string

    const validStatuses: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'BLOCKED']

    // over.id puede ser el ID de una columna (status) o el ID de otra tarea
    let newStatus: TaskStatus
    if (validStatuses.includes(overId as TaskStatus)) {
      newStatus = overId as TaskStatus
    } else {
      // Dropped sobre otra tarea → usar el status de esa tarea como columna destino
      const overTask = tasks.find(t => t.id === overId)
      if (!overTask) return
      newStatus = overTask.status
    }

    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return

    // Optimistic update
    syncTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

    try {
      await api.patch(`/api/tasks/${taskId}/status`, { status: newStatus })
    } catch {
      // Revert on error
      syncTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t))
    }
  }

  function onTaskUpdate(updated: Task) {
    syncTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  function onTaskAdd(task: Task) {
    syncTasks(prev => [...prev, task])
  }

  function onTaskDelete(id: string) {
    syncTasks(prev => prev.filter(t => t.id !== id))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasksByStatus(col.id)}
            projectId={projectId}
            isAdmin={isAdmin}
            users={users}
            onTaskUpdate={onTaskUpdate}
            onTaskAdd={onTaskAdd}
            onTaskDelete={onTaskDelete}
          />
        ))}
      </div>

      {/* DragOverlay: simple preview without useSortable to avoid duplicate id registration */}
      <DragOverlay>
        {activeTask ? (
          <div className="bg-white border border-[#17394f]/30 rounded-xl px-3 py-2.5 shadow-lg opacity-90 rotate-1 cursor-grabbing w-72">
            {activeTask.taskType && (
              <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mb-1.5 ${TASK_TYPE_COLOR[activeTask.taskType]}`}>
                {TASK_TYPE_LABEL[activeTask.taskType]}
              </span>
            )}
            <p className="text-sm font-medium text-slate-800 truncate">{activeTask.title}</p>
            {activeTask.assignees?.length > 0 && (
              <p className="text-xs text-slate-400 mt-1 truncate">
                {activeTask.assignees.map(a => a.name).join(', ')}
              </p>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
