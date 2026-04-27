'use client'

import { useState } from 'react'
import { WorkloadEntry } from '@/types/dashboard'

function WorkloadRow({ entry, maxLoad }: { entry: WorkloadEntry; maxLoad: number }) {
  const barWidth = maxLoad > 0 ? Math.round((entry.totalActive / maxLoad) * 100) : 0
  const barColor = entry.overdue > 0 ? 'bg-red-400' : entry.blocked > 0 ? 'bg-amber-400' : 'bg-brand-500'

  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <span className="text-slate-600 text-xs font-semibold">{entry.name.charAt(0)}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{entry.name}</p>
            {entry.area && <p className="text-xs text-slate-400">{entry.area}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs">
          {entry.overdue > 0 && (
            <span className="bg-red-100 text-red-600 font-medium px-1.5 py-0.5 rounded-full">{entry.overdue} atrasada{entry.overdue !== 1 ? 's' : ''}</span>
          )}
          {entry.blocked > 0 && (
            <span className="bg-amber-100 text-amber-600 font-medium px-1.5 py-0.5 rounded-full">{entry.blocked} bloqueada{entry.blocked !== 1 ? 's' : ''}</span>
          )}
          {entry.totalActive === 0 && (
            <span className="bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">Disponible</span>
          )}
          <span className="text-slate-400">{entry.totalActive} tareas</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barWidth}%` }} />
        </div>
        <span className="text-xs text-slate-400 w-8 text-right">{entry.loadPct}%</span>
      </div>
    </div>
  )
}

export function WorkloadWidget({ data }: { data: WorkloadEntry[] }) {
  const [areaFilter, setAreaFilter] = useState('')
  const [sort, setSort] = useState<'busy' | 'available' | 'alpha'>('busy')

  const areas = Array.from(new Set(data.map(e => e.area).filter(Boolean))) as string[]

  let filtered = areaFilter ? data.filter(e => e.area === areaFilter) : data
  if (sort === 'available') filtered = [...filtered].sort((a, b) => a.totalActive - b.totalActive)
  else if (sort === 'alpha') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  else filtered = [...filtered].sort((a, b) => b.totalActive - a.totalActive)

  const maxLoad = Math.max(...filtered.map(e => e.totalActive), 1)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-slate-900">Carga del equipo</h2>
        <div className="flex gap-2">
          {areas.length > 0 && (
            <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none" value={areaFilter} onChange={e => setAreaFilter(e.target.value)}>
              <option value="">Todas las áreas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none" value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
            <option value="busy">Más cargado</option>
            <option value="available">Más disponible</option>
            <option value="alpha">Alfabético</option>
          </select>
        </div>
      </div>
      {filtered.length === 0
        ? <p className="text-slate-400 text-sm py-4 text-center">Sin miembros en esta área</p>
        : filtered.map(e => <WorkloadRow key={e.userId} entry={e} maxLoad={maxLoad} />)
      }
    </div>
  )
}
