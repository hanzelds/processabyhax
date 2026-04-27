import Link from 'next/link'
import { Project, DeadlineStatus } from '@/types'
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_COLOR, formatDate } from '@/lib/utils'

const DEADLINE_LABEL: Record<DeadlineStatus, { label: string; cls: string }> = {
  on_track: { label: '🟢 En tiempo', cls: 'text-emerald-600' },
  urgent:   { label: '🟡 Próximo',   cls: 'text-amber-600'   },
  overdue:  { label: '🔴 Vencido',   cls: 'text-red-600'     },
  no_date:  { label: '⚪ Sin fecha', cls: 'text-slate-400'   },
}

export function ProjectCard({ project }: { project: Project }) {
  const dl       = DEADLINE_LABEL[project.deadlineStatus ?? 'no_date']
  const pct      = project.progressPct ?? 0
  const barColor = project.deadlineStatus === 'overdue'  ? 'bg-red-400'
                 : project.deadlineStatus === 'urgent'   ? 'bg-amber-400'
                 : 'bg-brand-500'

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block bg-white rounded-xl border border-slate-200 px-4 py-4 sm:px-5 active:bg-gray-50 hover:shadow-sm hover:border-slate-300 transition-all"
    >
      {/* Row 1: name + deadline pill */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-slate-900 font-medium text-sm">{project.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${PROJECT_STATUS_COLOR[project.status]}`}>
              {PROJECT_STATUS_LABEL[project.status]}
            </span>
          </div>
          <p className="text-slate-400 text-xs truncate">{project.client?.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xs font-medium ${dl.cls}`}>{dl.label}</p>
          {project.estimatedClose && (
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">{formatDate(project.estimatedClose)}</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-semibold text-slate-500 w-8 text-right tabular-nums">{pct}%</span>
      </div>

      {/* Row 3: stats + avatars */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          <span className="tabular-nums">{project.tasksCompleted ?? 0}/{project.tasksTotal ?? 0} tareas</span>
          {(project.tasksOverdue ?? 0) > 0 && (
            <span className="bg-red-100 text-red-600 font-medium px-1.5 py-0.5 rounded-full">
              {project.tasksOverdue} atrasada{project.tasksOverdue !== 1 ? 's' : ''}
            </span>
          )}
          {(project.tasksBlocked ?? 0) > 0 && (
            <span className="bg-amber-100 text-amber-700 font-medium px-1.5 py-0.5 rounded-full">
              {project.tasksBlocked} bloqueada{project.tasksBlocked !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {(project.members?.length ?? 0) > 0 && (
          <div className="flex -space-x-2 shrink-0">
            {project.members!.slice(0, 4).map(m => (
              <div
                key={m.id}
                title={m.name}
                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white"
                style={{ background: '#17394f' }}
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {project.members!.length > 4 && (
              <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                +{project.members!.length - 4}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
