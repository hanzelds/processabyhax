'use client'

import { useState } from 'react'
import { Task, TaskStatus, User } from '@/types'
import { isOverdue, TASK_STATUS_LABEL, TASK_STATUS_COLOR } from '@/lib/utils'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { TaskModal } from './TaskModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function calendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month - 1, 1)
  const last  = new Date(year, month, 0)
  const days: Date[] = []
  const startDow = (first.getDay() + 6) % 7
  for (let i = startDow; i > 0; i--) {
    const d = new Date(first); d.setDate(d.getDate() - i); days.push(d)
  }
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) days.push(new Date(d))
  while (days.length % 7 !== 0) {
    const d = new Date(days[days.length - 1]); d.setDate(d.getDate() + 1); days.push(d)
  }
  return days
}

// ── Status dot ────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<TaskStatus, string> = {
  PENDING:     'bg-slate-400',
  IN_PROGRESS: 'bg-blue-500',
  IN_REVIEW:   'bg-amber-500',
  COMPLETED:   'bg-emerald-500',
  BLOCKED:     'bg-red-500',
}

// ── Task chip inside a day cell ───────────────────────────────────────────────

function TaskChip({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = isOverdue(task.dueDate, task.status)
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      className={`w-full flex items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] hover:opacity-80 transition-opacity bg-white border border-slate-100 ${
        overdue ? 'border-l-2 border-l-red-400' : 'border-l-2 border-l-slate-300'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[task.status]}`} />
      <span className="font-medium text-slate-700 truncate">{task.title}</span>
    </button>
  )
}

// ── No date panel ─────────────────────────────────────────────────────────────

function NoDatePanel({
  tasks, onClose, isAdmin, users, onUpdate
}: {
  tasks: Task[]; onClose: () => void
  isAdmin: boolean; users: User[]
  onUpdate: (t: Task) => void
}) {
  const [selected, setSelected] = useState<Task | null>(null)

  return (
    <>
      <div className="w-64 shrink-0 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sin fecha</p>
            <p className="text-xs text-slate-400 mt-0.5">{tasks.length} tarea{tasks.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tasks.map(task => {
            const overdue = isOverdue(task.dueDate, task.status)
            return (
              <div
                key={task.id}
                onClick={() => setSelected(task)}
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 cursor-pointer hover:border-slate-200 hover:shadow-sm transition-all"
              >
                <p className="text-xs font-semibold text-slate-800 leading-snug mb-1.5">{task.title}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TASK_STATUS_COLOR[task.status]}`}>
                    {TASK_STATUS_LABEL[task.status]}
                  </span>
                  {task.assignees.length > 0 && (
                    <span className="text-[10px] text-slate-400">
                      {task.assignees[0].name.split(' ')[0]}
                      {task.assignees.length > 1 ? ` +${task.assignees.length - 1}` : ''}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {tasks.length === 0 && (
            <p className="text-xs text-slate-300 text-center py-8">Sin tareas sin fecha</p>
          )}
        </div>
      </div>

      {selected && (
        <TaskModal
          task={selected}
          isAdmin={isAdmin}
          users={users}
          onUpdate={updated => { onUpdate(updated); setSelected(updated) }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  tasks: Task[]
  isAdmin: boolean
  users: User[]
  showNoDate: boolean
  onToggleNoDate: () => void
  onUpdate: (task: Task) => void
}

export function TaskCalendarView({ tasks, isAdmin, users, showNoDate, onToggleNoDate, onUpdate }: Props) {
  const now   = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selected, setSelected] = useState<Task | null>(null)

  const days  = calendarDays(year, month)
  const today = isoDate(now)

  function navigate(delta: number) {
    let m = month + delta, y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1)  { m = 12; y-- }
    setMonth(m); setYear(y)
  }

  function tasksForDay(dateStr: string) {
    return tasks.filter(t => t.dueDate?.startsWith(dateStr))
  }

  const noDateTasks = tasks.filter(t => !t.dueDate)
  const monthName = new Date(year, month - 1, 1)
    .toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })

  return (
    <div className="flex gap-4 h-full">
      {/* Calendar */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Month nav */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-semibold text-slate-800 capitalize w-40">{monthName}</h2>
          <button onClick={() => navigate(1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1) }}
            className="text-xs text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1 hover:bg-slate-50"
          >
            Hoy
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100 flex-1">
          {days.map((day, i) => {
            const ds = isoDate(day)
            const isCurrentMonth = day.getMonth() + 1 === month
            const isToday = ds === today
            const dayTasks = tasksForDay(ds)

            return (
              <div
                key={i}
                className={`bg-white min-h-[90px] p-1.5 flex flex-col ${!isCurrentMonth ? 'opacity-40' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-[#17394f] text-white' : 'text-slate-600'
                  }`}>
                    {day.getDate()}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[9px] text-slate-400 font-medium">{dayTasks.length}</span>
                  )}
                </div>
                <div className="space-y-0.5 flex-1">
                  {dayTasks.slice(0, 4).map(t => (
                    <TaskChip key={t.id} task={t} onClick={() => setSelected(t)} />
                  ))}
                  {dayTasks.length > 4 && (
                    <p className="text-[10px] text-slate-400 font-medium pl-1">+{dayTasks.length - 4} más</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* No date panel */}
      {showNoDate && (
        <NoDatePanel
          tasks={noDateTasks}
          onClose={onToggleNoDate}
          isAdmin={isAdmin}
          users={users}
          onUpdate={onUpdate}
        />
      )}

      {/* Task detail modal */}
      {selected && (
        <TaskModal
          task={selected}
          isAdmin={isAdmin}
          users={users}
          onUpdate={updated => { onUpdate(updated); setSelected(updated) }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
