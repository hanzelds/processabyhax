'use client'

import { useState } from 'react'
import { Task, TaskStatus, User } from '@/types'
import {
  formatDate, isOverdue,
  TASK_STATUS_LABEL, TASK_STATUS_COLOR,
  TASK_TYPE_LABEL, TASK_TYPE_COLOR,
} from '@/lib/utils'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { TaskModal } from './TaskModal'

type SortKey = 'title' | 'status' | 'assignee' | 'dueDate'
type SortDir = 'asc' | 'desc'

const STATUS_ORDER: Record<TaskStatus, number> = {
  BLOCKED: 0, IN_PROGRESS: 1, IN_REVIEW: 2, PENDING: 3, COMPLETED: 4,
}

interface Props {
  tasks: Task[]
  isAdmin: boolean
  users: User[]
  onUpdate: (task: Task) => void
}

export function TaskListView({ tasks, isAdmin, users, onUpdate }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selected, setSelected] = useState<Task | null>(null)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'title')    cmp = a.title.localeCompare(b.title)
    if (sortKey === 'status')   cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (sortKey === 'assignee') {
      const aName = a.assignees[0]?.name ?? ''
      const bName = b.assignees[0]?.name ?? ''
      cmp = aName.localeCompare(bName)
    }
    if (sortKey === 'dueDate') {
      const da = a.dueDate ?? '9999'
      const db = b.dueDate ?? '9999'
      cmp = da < db ? -1 : da > db ? 1 : 0
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp className="w-3 h-3 opacity-20" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-slate-500" />
      : <ChevronDown className="w-3 h-3 text-slate-500" />
  }

  function Th({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        onClick={() => toggleSort(k)}
        className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors"
      >
        <div className="flex items-center gap-1">
          {label}
          <SortIcon k={k} />
        </div>
      </th>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-300">
        <p className="text-sm font-medium">No hay tareas en este proyecto</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <Th label="Tarea"    k="title"    />
              <Th label="Estado"   k="status"   />
              <Th label="Equipo"   k="assignee" />
              <Th label="Fecha"    k="dueDate"  />
              <th className="px-4 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(task => {
              const overdue   = isOverdue(task.dueDate, task.status)
              const typeLabel = task.taskType ? TASK_TYPE_LABEL[task.taskType] : null
              const typeColor = task.taskType ? TASK_TYPE_COLOR[task.taskType] : null

              return (
                <tr
                  key={task.id}
                  onClick={() => setSelected(task)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  {/* Título */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {typeLabel && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${typeColor}`}>
                          {typeLabel}
                        </span>
                      )}
                      <span className="text-sm font-medium text-slate-800 truncate max-w-xs">
                        {task.title}
                      </span>
                    </div>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TASK_STATUS_COLOR[task.status]}`}>
                      {TASK_STATUS_LABEL[task.status]}
                    </span>
                  </td>

                  {/* Equipo */}
                  <td className="px-4 py-3">
                    {task.assignees.length === 0 ? (
                      <span className="text-slate-300 text-xs">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {task.assignees.slice(0, 2).map(a => (
                          <span key={a.id} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                            {a.name.split(' ')[0]}
                          </span>
                        ))}
                        {task.assignees.length > 2 && (
                          <span className="text-xs text-slate-400">+{task.assignees.length - 2}</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Fecha */}
                  <td className="px-4 py-3">
                    {task.dueDate ? (
                      <span className={`text-sm tabular-nums ${overdue ? 'text-red-500 font-medium' : 'text-slate-600'}`}>
                        {formatDate(task.dueDate)}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Arrow */}
                  <td className="px-4 py-3 text-slate-300">›</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <TaskModal
          task={selected}
          isAdmin={isAdmin}
          users={users}
          onUpdate={updated => {
            onUpdate(updated)
            setSelected(updated)
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
