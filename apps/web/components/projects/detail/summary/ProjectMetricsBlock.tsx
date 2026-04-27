'use client'

import { ProjectMetrics } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  PENDING:     'bg-slate-400',
  IN_PROGRESS: 'bg-brand-500',
  IN_REVIEW:   'bg-amber-400',
  COMPLETED:   'bg-emerald-400',
  BLOCKED:     'bg-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:     'Pendiente',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW:   'En revisión',
  COMPLETED:   'Completada',
  BLOCKED:     'Bloqueada',
}

export function ProjectMetricsBlock({ metrics }: { metrics: ProjectMetrics }) {
  const total = metrics.tasksTotal || 1

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
      <h3 className="font-semibold text-slate-900">Métricas del proyecto</h3>

      {/* Progress */}
      <div>
        <div className="flex justify-between mb-1.5">
          <p className="text-sm text-slate-600">Progreso general</p>
          <p className="text-sm font-bold text-slate-900">{metrics.progressPct}%</p>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${metrics.progressPct}%` }} />
        </div>
      </div>

      {/* Stacked bar by status */}
      {metrics.tasksTotal > 0 && (
        <div>
          <p className="text-sm text-slate-600 mb-2">Distribución por estado</p>
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            {Object.entries(metrics.tasksByStatus).map(([status, count]) => (
              count > 0 && (
                <div
                  key={status}
                  title={`${STATUS_LABELS[status] ?? status}: ${count}`}
                  className={`${STATUS_COLORS[status] ?? 'bg-slate-300'} transition-all`}
                  style={{ width: `${(count / total) * 100}%` }}
                />
              )
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {Object.entries(metrics.tasksByStatus).filter(([, c]) => c > 0).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`w-2 h-2 rounded-full inline-block ${STATUS_COLORS[status] ?? 'bg-slate-300'}`} />
                {STATUS_LABELS[status] ?? status}: <span className="font-semibold text-slate-700">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${metrics.tasksOverdue > 0 ? 'text-red-600' : 'text-slate-900'}`}>{metrics.tasksOverdue}</p>
          <p className="text-xs text-slate-500 mt-0.5">Atrasadas</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${metrics.tasksUnassigned > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{metrics.tasksUnassigned}</p>
          <p className="text-xs text-slate-500 mt-0.5">Sin asignar</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{metrics.activeMembers}</p>
          <p className="text-xs text-slate-500 mt-0.5">Activos</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{metrics.tasksCompleted}</p>
          <p className="text-xs text-slate-500 mt-0.5">Completadas</p>
        </div>
      </div>
    </div>
  )
}
