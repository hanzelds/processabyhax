import Link from 'next/link'
import { AdminOverview } from '@/types/dashboard'

type Deadline = AdminOverview['deadlines'][number]

const STATUS_LABEL: Record<string, string> = {
  PENDING:     'Pendiente',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW:   'En revisión',
  BLOCKED:     'Bloqueada',
}

function DeadlineRow({ d }: { d: Deadline }) {
  const isToday   = d.daysLeft === 0
  const isTomorrow = d.daysLeft === 1
  const isOverdue = d.daysLeft !== null && d.daysLeft < 0

  const urgencyColor = isOverdue
    ? 'text-red-600 bg-red-50 border-red-100'
    : isToday
    ? 'text-red-500 bg-red-50 border-red-100'
    : isTomorrow
    ? 'text-amber-600 bg-amber-50 border-amber-100'
    : 'text-slate-500 bg-slate-50 border-slate-100'

  const daysLabel = isOverdue
    ? `${Math.abs(d.daysLeft!)}d vencida`
    : isToday ? 'Hoy'
    : isTomorrow ? 'Mañana'
    : `${d.daysLeft}d`

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div className={`shrink-0 w-14 text-center text-xs font-semibold px-2 py-1 rounded-lg border ${urgencyColor}`}>
        {daysLabel}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{d.title}</p>
        <p className="text-xs text-slate-400 truncate">
          {d.clientName} · {d.projectName}
        </p>
      </div>
      {d.assignees.length > 0 && (
        <div className="flex -space-x-1.5 shrink-0">
          {d.assignees.slice(0, 3).map(a => (
            <div
              key={a.id}
              title={a.name}
              className="w-6 h-6 rounded-full bg-brand-100 border-2 border-white flex items-center justify-center"
            >
              <span className="text-[9px] font-bold text-brand-700">{a.name.charAt(0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function UpcomingDeadlines({ deadlines }: { deadlines: Deadline[] }) {
  if (deadlines.length === 0) return null

  const overdue = deadlines.filter(d => d.daysLeft !== null && d.daysLeft < 0)
  const upcoming = deadlines.filter(d => d.daysLeft === null || d.daysLeft >= 0)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-slate-900">Próximos vencimientos</h2>
          <p className="text-xs text-slate-400 mt-0.5">Tareas del equipo · próximos 7 días</p>
        </div>
        {overdue.length > 0 && (
          <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-1 rounded-full">
            {overdue.length} vencida{overdue.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div>
        {overdue.map(d => <DeadlineRow key={d.taskId} d={d} />)}
        {upcoming.map(d => <DeadlineRow key={d.taskId} d={d} />)}
      </div>
    </div>
  )
}
