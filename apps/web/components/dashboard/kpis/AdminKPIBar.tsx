import { AdminKPIs } from '@/types/dashboard'

interface KPICardProps {
  label: string
  value: number
  alert?: 'red' | 'yellow'
  icon: string
}

function KPICard({ label, value, alert, icon }: KPICardProps) {
  const alertClass = alert === 'red' && value > 0
    ? 'border-red-200 bg-red-50'
    : alert === 'yellow' && value > 0
    ? 'border-amber-200 bg-amber-50'
    : 'border-slate-200 bg-white'

  const valueClass = alert === 'red' && value > 0
    ? 'text-red-600'
    : alert === 'yellow' && value > 0
    ? 'text-amber-600'
    : 'text-slate-900'

  return (
    <div className={`rounded-xl border px-5 py-4 flex items-center gap-4 ${alertClass}`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
        <p className="text-slate-500 text-xs font-medium mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export function AdminKPIBar({ kpis }: { kpis: AdminKPIs }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <KPICard label="Proyectos activos"   value={kpis.activeProjects}   icon="⬡" />
      <KPICard label="Tareas en progreso"  value={kpis.tasksInProgress}  icon="◈" />
      <KPICard label="Tareas atrasadas"    value={kpis.tasksOverdue}     icon="⚠" alert="red" />
      <KPICard label="Tareas bloqueadas"   value={kpis.tasksBlocked}     icon="⊘" alert="yellow" />
    </div>
  )
}
