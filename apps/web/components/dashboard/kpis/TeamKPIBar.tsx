import { TeamKPIs } from '@/types/dashboard'
import { StreakBadge } from './StreakBadge'

function StatCard({
  label, value, icon, alert, dim,
  custom,
}: {
  label: string
  value?: number | string
  icon: string
  alert?: boolean
  dim?: boolean
  custom?: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border bg-white px-4 py-3.5 flex items-center gap-3.5 transition-colors ${
      alert ? 'border-red-200 bg-red-50' : dim ? 'border-slate-100 bg-slate-50/60' : 'border-slate-200'
    }`}>
      <span className="text-xl shrink-0">{icon}</span>
      <div className="min-w-0">
        {custom ?? (
          <p className={`text-2xl font-bold tabular-nums leading-tight ${
            alert ? 'text-red-600' : dim ? 'text-slate-400' : 'text-slate-900'
          }`}>
            {value}
          </p>
        )}
        <p className={`text-xs font-medium mt-0.5 truncate ${
          alert ? 'text-red-500' : 'text-slate-500'
        }`}>
          {label}
        </p>
      </div>
    </div>
  )
}

export function TeamKPIBar({ kpis }: { kpis: TeamKPIs }) {
  return (
    <div className="space-y-3 mb-8">
      {/* Fila 1 — Estado actual */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Para hoy"      icon="📅" value={kpis.todayCount} />
        <StatCard label="En progreso"   icon="▶" value={kpis.inProgress}  />
        <StatCard label="Atrasadas"     icon="⚠" value={kpis.overdue}    alert={kpis.overdue > 0} />
        <StatCard label="Bloqueadas"    icon="⛔" value={kpis.blocked}    alert={kpis.blocked > 0} />
      </div>

      {/* Fila 2 — Rendimiento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Semana"        icon="✓"  value={kpis.completedWeek} />
        <StatCard label="Este mes"      icon="📆" value={kpis.completedMonth} dim={kpis.completedMonth === 0} />
        <StatCard
          label="Cumplimiento 30d"
          icon="🎯"
          value={`${kpis.completionRatePct}%`}
          alert={kpis.completionRatePct < 70}
          dim={kpis.completionRatePct === 100}
        />
        <StatCard
          label="Racha"
          icon={kpis.streakDays >= 3 ? '' : '📈'}
          custom={<StreakBadge days={kpis.streakDays} />}
        />
      </div>
    </div>
  )
}
