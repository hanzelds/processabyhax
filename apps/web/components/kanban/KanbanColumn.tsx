'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Task, TaskStatus, User } from '@/types'
import { KanbanCard } from './KanbanCard'
import { NewTaskButton } from './NewTaskButton'

interface ColumnDef {
  id: TaskStatus
  label: string
  color: string
}

interface Props {
  column: ColumnDef
  tasks: Task[]
  projectId: string
  isAdmin: boolean
  users: User[]
  onTaskUpdate: (task: Task) => void
  onTaskAdd: (task: Task) => void
}

export function KanbanColumn({ column, tasks, projectId, isAdmin, users, onTaskUpdate, onTaskAdd }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className={`flex items-center justify-between mb-3 px-1`}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">{column.label}</h3>
          <span className="text-xs text-slate-400 bg-slate-100 rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {tasks.length}
          </span>
        </div>
        {isAdmin && (
          <NewTaskButton projectId={projectId} status={column.id} users={users} onCreated={onTaskAdd} />
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-24 rounded-xl border-2 border-dashed p-2 transition-colors ${
          isOver ? `${column.color} bg-slate-50` : 'border-transparent'
        }`}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map(task => (
              <KanbanCard key={task.id} task={task} onUpdate={onTaskUpdate} isAdmin={isAdmin} users={users} />
            ))}
          </div>
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-16 text-slate-300 text-xs">
            Suelta aquí
          </div>
        )}
      </div>
    </div>
  )
}
