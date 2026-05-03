import { LeadKPIs } from '@/types/dashboard'

function KPICard({
  label, value, icon, alert, positive, sub,
}: {
  label: string
  value: number | string
  icon: string
  alert?: boolean
  positive?: boolean
  sub?: string
}) {
  const color = alert
    ? 'text-red-600'
    : positive
    ? 'text-emerald-600'
    : 'text-slate-900'

  const bg = alert
    ? 'bg-red-50 border-red-200'
    : positive
    ? 'bg-emerald-50 border-emerald-200'
    : 'bg-white border-slate-200'

  return (
    <div className={`rounded-xl border px-4 py-3.5 flex items-start gap-3 ${bg}`}>
      <span className="text-xl mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className={`text-2xl font-bold tabular-nums leading-tight ${color}`}>{value}</p>
        <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{label}</p>
        {sub && <p className={`text-[10px] mt-0.5 truncate ${alert ? 'text-red-400' : 'text-slate-400'}`}>{sub}</p>}
      </div>
    </div>
  )
}

export function LeadKPIBar({ kpis }: { kpis: LeadKPIs }) {
  const { projects, team } = kpis
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      <KPICard
        label="Proyectos activos" icon="📁"
        value={projects.active}
      />
      <KPICard
        label="En riesgo" icon="⚠"
        value={projects.atRisk}
        alert={projects.atRisk > 0}
        sub={projects.atRisk > 0 ? '≤ 7 días y < 80%' : undefined}
      />
      <KPICard
        label="Progreso promedio" icon="📊"
        value={`${projects.avgProgressPct}%`}
        alert={projects.avgProgressPct < 50}
      />
      <KPICard
        label="Atrasadas equipo" icon="🔴"
        value={team.overdueTasksCount}
        alert={team.overdueTasksCount > 0}
      />
      <KPICard
        label="Bloqueadas equipo" icon="⛔"
        value={team.blockedTasksCount}
        alert={team.blockedTasksCount > 0}
      />
      <KPICard
        label="Disponibles" icon="✅"
        value={team.availableMembers}
        positive={team.availableMembers > 0}
        sub={team.availableMembers > 0 ? 'para asignar' : undefined}
      />
    </div>
  )
}
