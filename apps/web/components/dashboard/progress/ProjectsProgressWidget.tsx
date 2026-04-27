'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ProjectProgress } from '@/types/dashboard'
import { formatDate } from '@/lib/utils'

function ProgressBar({ pct, isOverdue, isUrgent }: { pct: number; isOverdue: boolean; isUrgent: boolean }) {
  const color = isOverdue ? 'bg-red-400' : isUrgent ? 'bg-amber-400' : 'bg-brand-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 w-8 text-right">{pct}%</span>
    </div>
  )
}

export function ProjectsProgressWidget({ data, title = 'Progreso de proyectos' }: { data: ProjectProgress[]; title?: string }) {
  const [sort, setSort] = useState<'deadline' | 'asc' | 'desc'>('deadline')

  const sorted = [...data].sort((a, b) => {
    if (sort === 'asc') return a.progressPct - b.progressPct
    if (sort === 'desc') return b.progressPct - a.progressPct
    // deadline: vencidos primero, luego por días restantes
    const aDays = a.daysRemaining ?? 9999
    const bDays = b.daysRemaining ?? 9999
    return aDays - bDays
  })

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none" value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
          <option value="deadline">Por vencimiento</option>
          <option value="asc">Progreso ↑</option>
          <option value="desc">Progreso ↓</option>
        </select>
      </div>

      {sorted.length === 0
        ? <p className="text-slate-400 text-sm py-4 text-center">No hay proyectos activos</p>
        : sorted.map(p => (
          <Link href={`/projects/${p.projectId}`} key={p.projectId} className="block py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-5 px-5 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{p.projectName}</p>
                <p className="text-xs text-slate-400 truncate">{p.clientName}</p>
              </div>
              <div className="text-right shrink-0 text-xs">
                <p className="text-slate-500">{p.tasksCompleted}/{p.tasksTotal} tareas</p>
                {p.estimatedClose && (
                  <p className={`mt-0.5 font-medium ${p.isOverdue ? 'text-red-500' : p.isUrgent ? 'text-amber-500' : 'text-slate-400'}`}>
                    {p.isOverdue ? '⚠ Vencido' : p.isUrgent ? `⚡ ${p.daysRemaining}d` : formatDate(p.estimatedClose)}
                  </p>
                )}
              </div>
            </div>
            <ProgressBar pct={p.progressPct} isOverdue={p.isOverdue} isUrgent={p.isUrgent} />
            {p.noTasks && <p className="text-xs text-amber-500 mt-1">Sin tareas asignadas</p>}
            {p.suggestClose && <p className="text-xs text-emerald-600 mt-1">✓ Listo para cerrar</p>}
          </Link>
        ))
      }
    </div>
  )
}
