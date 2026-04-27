import { TeamKPIs } from '@/types/dashboard'

export function TeamKPIBar({ kpis }: { kpis: TeamKPIs }) {
  const cards = [
    { label: 'Mis tareas hoy',          value: kpis.todayCount,    icon: '📅', color: 'text-slate-900' },
    { label: 'En progreso',             value: kpis.inProgress,    icon: '◈',  color: 'text-blue-600' },
    { label: 'Atrasadas',               value: kpis.overdue,       icon: '⚠',  color: kpis.overdue > 0 ? 'text-red-600' : 'text-slate-900' },
    { label: 'Completadas esta semana', value: kpis.completedWeek, icon: '✓',  color: 'text-emerald-600' },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map(c => (
        <div key={c.label} className={`rounded-xl border border-slate-200 bg-white px-5 py-4 flex items-center gap-4 ${c.value > 0 && c.label === 'Atrasadas' ? 'border-red-200 bg-red-50' : ''}`}>
          <span className="text-2xl">{c.icon}</span>
          <div>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-slate-500 text-xs font-medium mt-0.5">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
