import { LeadKPIs, TeamKPIs, ProjectProgress } from '@/types/dashboard'
import { Task, User } from '@/types'
import { LeadKPIBar } from './kpis/LeadKPIBar'
import { LeadTeamBlock } from './kpis/LeadTeamBlock'
import { TeamKPIBar } from './kpis/TeamKPIBar'
import { ProjectsProgressWidget } from './progress/ProjectsProgressWidget'
import { TaskCard } from '@/components/ui/TaskCard'

interface Props {
  user: User
  leadKpis: LeadKPIs
  teamKpis: TeamKPIs
  tasks: { today: Task[]; pending: Task[]; overdue: Task[] }
  progress: ProjectProgress[]
}

export function LeadDashboard({ user, leadKpis, teamKpis, tasks, progress }: Props) {
  const total = tasks.today.length + tasks.pending.length + tasks.overdue.length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Hola, {user.name.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Vista de lead · {leadKpis.projects.active} proyecto{leadKpis.projects.active !== 1 ? 's' : ''} activo{leadKpis.projects.active !== 1 ? 's' : ''}
          {' · '}
          {leadKpis.team.totalMembers} miembro{leadKpis.team.totalMembers !== 1 ? 's' : ''} en el equipo
        </p>
      </div>

      {/* Lead KPI Bar — 6 tarjetas sobre el equipo y proyectos */}
      <section className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
          Tu equipo y proyectos
        </p>
        <LeadKPIBar kpis={leadKpis} />
      </section>

      {/* Layout principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Columna izquierda y central — Personal + Tareas */}
        <div className="lg:col-span-2 space-y-6">

          {/* KPIs personales del lead */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
              Tu rendimiento personal
            </p>
            <TeamKPIBar kpis={teamKpis} />
          </section>

          {/* Tareas propias */}
          {tasks.overdue.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Atrasadas ({tasks.overdue.length})
              </h2>
              <div className="grid gap-2">
                {tasks.overdue.map(t => <TaskCard key={t.id} task={t} overdue />)}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Hoy ({tasks.today.length})
            </h2>
            {tasks.today.length === 0
              ? <p className="text-slate-400 text-sm">Sin vencimientos hoy</p>
              : <div className="grid gap-2">{tasks.today.map(t => <TaskCard key={t.id} task={t} />)}</div>}
          </section>

          {tasks.pending.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                Pendientes ({tasks.pending.length})
              </h2>
              <div className="grid gap-2">{tasks.pending.map(t => <TaskCard key={t.id} task={t} />)}</div>
            </section>
          )}
        </div>

        {/* Columna derecha — Equipo + Progreso */}
        <div className="space-y-6">
          <LeadTeamBlock kpis={leadKpis} />
          <ProjectsProgressWidget data={progress} title="Progreso de proyectos" />
        </div>
      </div>
    </div>
  )
}
