'use client'

import { ClientMetrics } from '@/types'
import { formatDate } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:      '#2e84a8',
  IN_PROGRESS: '#f59e0b',
  COMPLETED:   '#10b981',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:      'Activo',
  IN_PROGRESS: 'En progreso',
  COMPLETED:   'Completado',
}

function MonthLabel(month: string) {
  const [y, m] = month.split('-')
  const labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return labels[parseInt(m) - 1] ?? m
}

interface Props { metrics: ClientMetrics }

export function ClientMetricsTab({ metrics }: Props) {
  const maxBar = Math.max(...metrics.tasksByMonth.map(m => m.completed), 1)
  const totalStatus = Object.values(metrics.projectsByStatus).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="space-y-6">
      {/* KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Proyectos totales', value: metrics.totalProjects, color: 'text-slate-900' },
          { label: 'Proyectos activos', value: metrics.activeProjects, color: 'text-brand-700' },
          { label: 'Tareas completadas', value: metrics.completedTasksTotal, color: 'text-emerald-600' },
          { label: 'Tareas atrasadas', value: metrics.overdueTasksActive, color: metrics.overdueTasksActive > 0 ? 'text-red-600' : 'text-slate-900' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity by month */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Tareas completadas (últimos 6 meses)</h3>
          <div className="flex items-end gap-2 h-32">
            {metrics.tasksByMonth.map(({ month, completed }) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-700">{completed > 0 ? completed : ''}</span>
                <div className="w-full rounded-t-sm" style={{
                  height: `${Math.max((completed / maxBar) * 100, 4)}%`,
                  background: '#17394f',
                  opacity: completed > 0 ? 1 : 0.2,
                }} />
                <span className="text-xs text-slate-400">{MonthLabel(month)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Projects by status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Proyectos por estado</h3>
          {Object.keys(metrics.projectsByStatus).length === 0
            ? <p className="text-slate-400 text-sm py-8 text-center">Sin proyectos</p>
            : (
              <>
                {/* Horizontal bar */}
                <div className="flex h-4 rounded-full overflow-hidden mb-4 gap-px">
                  {Object.entries(metrics.projectsByStatus).map(([status, count]) => (
                    <div key={status} title={`${STATUS_LABELS[status] ?? status}: ${count}`}
                      style={{ width: `${(count / totalStatus) * 100}%`, background: STATUS_COLORS[status] ?? '#94a3b8' }} />
                  ))}
                </div>
                <div className="space-y-2">
                  {Object.entries(metrics.projectsByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[status] ?? '#94a3b8' }} />
                        <span className="text-slate-600">{STATUS_LABELS[status] ?? status}</span>
                      </div>
                      <span className="font-semibold text-slate-900">{count}</span>
                    </div>
                  ))}
                </div>
              </>
            )
          }
        </div>
      </div>

      {/* Context metrics */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Relación comercial</h3>
        <dl className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {metrics.monthsAsClient !== null && (
            <div className="bg-slate-50 rounded-xl p-3">
              <dt className="text-xs text-slate-500 mb-1">Tiempo como cliente</dt>
              <dd className="font-semibold text-slate-900">{metrics.monthsAsClient} meses</dd>
            </div>
          )}
          {metrics.lastProjectDate && (
            <div className="bg-slate-50 rounded-xl p-3">
              <dt className="text-xs text-slate-500 mb-1">Último proyecto</dt>
              <dd className="font-semibold text-slate-900">{formatDate(metrics.lastProjectDate)}</dd>
            </div>
          )}
          <div className="bg-slate-50 rounded-xl p-3">
            <dt className="text-xs text-slate-500 mb-1">Equipo involucrado</dt>
            <dd className="font-semibold text-slate-900">{metrics.teamMembersInvolved} miembro{metrics.teamMembersInvolved !== 1 ? 's' : ''}</dd>
          </div>
          {metrics.topArea && (
            <div className="bg-slate-50 rounded-xl p-3">
              <dt className="text-xs text-slate-500 mb-1">Área con más trabajo</dt>
              <dd className="font-semibold text-slate-900">{metrics.topArea}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
