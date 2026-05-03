import { LeadKPIs } from '@/types/dashboard'
import Link from 'next/link'

export function LeadTeamBlock({ kpis }: { kpis: LeadKPIs }) {
  const { team, projects } = kpis

  return (
    <div className="space-y-4">
      {/* Resumen del equipo */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Estado del equipo</h3>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <p className="text-xl font-bold text-slate-800">{team.totalMembers}</p>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5">Total</p>
          </div>
          <div className={`text-center p-3 rounded-xl ${team.availableMembers > 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
            <p className={`text-xl font-bold ${team.availableMembers > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
              {team.availableMembers}
            </p>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5">Disponibles</p>
          </div>
          <div className={`text-center p-3 rounded-xl ${team.overdueTasksCount > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
            <p className={`text-xl font-bold ${team.overdueTasksCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {team.overdueTasksCount}
            </p>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5">Atrasadas</p>
          </div>
        </div>

        {/* Miembro con más carga */}
        {team.mostLoadedMember && (
          <div className="border border-amber-200 bg-amber-50 rounded-xl px-3 py-2.5 flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-amber-800">Mayor carga</p>
              <p className="text-sm font-medium text-slate-800 mt-0.5">{team.mostLoadedMember.name}</p>
              {team.mostLoadedMember.area && (
                <p className="text-[10px] text-slate-500">{team.mostLoadedMember.area}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-amber-700">{team.mostLoadedMember.load}</p>
              <p className="text-[10px] text-amber-600">tareas activas</p>
            </div>
          </div>
        )}

        {/* Miembros con tareas atrasadas */}
        {team.overdueMembers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">Con tareas vencidas</p>
            {team.overdueMembers.map(m => (
              <div key={m.id} className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-700">{m.name}</span>
                <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                  {m.overdueCount} vencida{m.overdueCount !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {team.totalMembers === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            No hay miembros en tus proyectos activos
          </p>
        )}
      </div>

      {/* Tasa de entrega */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Entrega a tiempo</h3>
        <div className="flex items-end gap-2 mb-2">
          <p className={`text-3xl font-bold tabular-nums ${
            projects.deliveryRatePct >= 80 ? 'text-emerald-600' :
            projects.deliveryRatePct >= 60 ? 'text-amber-600' : 'text-red-600'
          }`}>
            {projects.deliveryRatePct}%
          </p>
          <p className="text-xs text-slate-400 mb-1">últimos 90 días</p>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              projects.deliveryRatePct >= 80 ? 'bg-emerald-400' :
              projects.deliveryRatePct >= 60 ? 'bg-amber-400' : 'bg-red-400'
            }`}
            style={{ width: `${projects.deliveryRatePct}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          Proyectos cerrados antes de la fecha estimada
        </p>
      </div>

      {/* Link rápido a proyectos */}
      <Link
        href="/projects"
        className="block text-center text-xs font-medium text-[#17394f] hover:text-[#17394f]/80 py-2 transition-colors"
      >
        Ver todos los proyectos →
      </Link>
    </div>
  )
}
