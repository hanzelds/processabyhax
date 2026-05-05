import Link from 'next/link'
import { Task } from '@/types'
import { formatDate, TASK_STATUS_LABEL, TASK_STATUS_COLOR, isOverdue } from '@/lib/utils'

export function TaskCard({ task, overdue }: { task: Task; overdue?: boolean }) {
  return (
    <Link
      href={`/projects/${task.projectId}`}
      className={`block bg-white rounded-xl border px-4 py-3.5 active:bg-gray-50 hover:shadow-sm transition-all ${
        overdue ? 'border-red-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-slate-900 text-sm font-medium leading-snug">{task.title}</p>
          {task.project && (
            <p className="text-slate-400 text-xs mt-0.5 truncate">
              {task.project.client?.name} · {task.project.name}
            </p>
          )}
          {task.briefId && (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded-full border border-purple-100">
              📄 Brief
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TASK_STATUS_COLOR[task.status]}`}>
            {TASK_STATUS_LABEL[task.status]}
          </span>
          {task.dueDate && (
            <span className={`text-xs tabular-nums ${isOverdue(task.dueDate, task.status) ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
