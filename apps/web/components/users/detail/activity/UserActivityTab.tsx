'use client'

import { useState, useEffect } from 'react'
import { UserMetrics } from '@/types'
import { api } from '@/lib/api'

interface Props { userId: string }

export function UserActivityTab({ userId }: Props) {
  const [metrics, setMetrics] = useState<UserMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<UserMetrics>(`/api/users/${userId}/metrics`)
      .then(setMetrics)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Cargando métricas…</div>
  if (!metrics) return <div className="py-12 text-center text-slate-400 text-sm">No se pudieron cargar las métricas</div>

  const kpis = [
    { label: 'Completadas (total)', value: metrics.tasksCompletedTotal, color: 'text-slate-900' },
    { label: 'Completadas este mes', value: metrics.tasksCompletedMonth, color: 'text-brand-700' },
    { label: 'Tasa de cumplimiento', value: metrics.completionRatePct != null ? `${metrics.completionRatePct}%` : '—', color: metrics.completionRatePct != null && metrics.completionRatePct >= 80 ? 'text-emerald-600' : 'text-amber-600' },
    { label: 'Proyectos activos', value: metrics.activeProjects, color: 'text-slate-900' },
    { label: 'Carga actual', value: metrics.currentWorkload, color: 'text-slate-900' },
    { label: 'Tareas atrasadas', value: metrics.overdueTasks, color: metrics.overdueTasks > 0 ? 'text-red-600' : 'text-slate-900' },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Work by project */}
      {metrics.workByProject.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Trabajo por proyecto</h4>
          <div className="space-y-3">
            {metrics.workByProject.map(w => (
              <div key={w.projectId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate font-medium">{w.projectName}</p>
                  <p className="text-xs text-slate-400 truncate">{w.clientName}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-24 bg-slate-100 rounded-full h-1.5">
                    <div
                      className="bg-brand-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min((w.count / (metrics.tasksCompletedTotal || 1)) * 100 * 3, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-600 w-6 text-right">{w.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h4 className="text-sm font-semibold text-slate-700 mb-4">Actividad reciente</h4>
        {metrics.recentActivity.length === 0
          ? <p className="text-sm text-slate-400 text-center py-4">Sin actividad registrada</p>
          : (
            <div className="space-y-3">
              {metrics.recentActivity.map(a => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{a.entityName}</p>
                    <p className="text-xs text-slate-400">{a.relativeTime}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}
