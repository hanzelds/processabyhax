import { AdminKPIs, AdminOverview } from '@/types/dashboard'
import Link from 'next/link'

interface KPICardProps {
  label: string
  value: number
  alert?: 'red' | 'yellow' | 'green'
  icon: string
  href?: string
  sublabel?: string
}

function KPICard({ label, value, alert, icon, href, sublabel }: KPICardProps) {
  const alertClass =
    alert === 'red'    && value > 0 ? 'border-red-200 bg-red-50' :
    alert === 'yellow' && value > 0 ? 'border-amber-200 bg-amber-50' :
    alert === 'green'               ? 'border-emerald-200 bg-emerald-50' :
    'border-slate-200 bg-white'

  const valueClass =
    alert === 'red'    && value > 0 ? 'text-red-600' :
    alert === 'yellow' && value > 0 ? 'text-amber-600' :
    alert === 'green'               ? 'text-emerald-600' :
    'text-slate-900'

  const card = (
    <div className={`rounded-xl border px-4 py-4 flex items-center gap-3 h-full transition-shadow ${alertClass} ${href ? 'hover:shadow-sm cursor-pointer' : ''}`}>
      <span className="text-xl leading-none shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className={`text-2xl font-bold leading-none ${valueClass}`}>{value}</p>
        <p className="text-slate-500 text-xs font-medium mt-1.5 leading-snug">{label}</p>
        {/* Reserve space for sublabel on all cards to keep uniform height */}
        <p className="text-[10px] mt-0.5 leading-none" style={{ minHeight: '12px' }}>
          {sublabel && <span className="text-slate-400">{sublabel}</span>}
        </p>
      </div>
    </div>
  )

  return href ? <Link href={href} className="block h-full">{card}</Link> : card
}

interface Props {
  kpis: AdminKPIs
  overview: Pick<AdminOverview, 'completedThisWeek' | 'completedThisMonth' | 'activeClients'>
}

export function AdminKPIBar({ kpis, overview }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6 items-stretch">
      <KPICard label="Proyectos activos"  value={kpis.activeProjects}        icon="⬡" href="/projects" />
      <KPICard label="Tareas en progreso" value={kpis.tasksInProgress}       icon="◈" />
      <KPICard label="Completadas / sem." value={overview.completedThisWeek} icon="✓" alert="green" sublabel={`${overview.completedThisMonth} este mes`} />
      <KPICard label="Clientes activos"   value={overview.activeClients}     icon="◉" href="/clients" />
      <KPICard label="Atrasadas"          value={kpis.tasksOverdue}          icon="⚠" alert="red" />
      <KPICard label="Bloqueadas"         value={kpis.tasksBlocked}          icon="⊘" alert="yellow" />
    </div>
  )
}
