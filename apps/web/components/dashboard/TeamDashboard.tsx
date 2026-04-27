import { TeamKPIs, ProjectProgress } from '@/types/dashboard'
import { TeamKPIBar } from './kpis/TeamKPIBar'
import { ProjectsProgressWidget } from './progress/ProjectsProgressWidget'
import { TaskCard } from '@/components/ui/TaskCard'
import { Task, User } from '@/types'

interface Props {
  user: User
  kpis: TeamKPIs
  tasks: { today: Task[]; pending: Task[]; overdue: Task[] }
  progress: ProjectProgress[]
}

export function TeamDashboard({ user, kpis, tasks, progress }: Props) {
  const total = tasks.today.length + tasks.pending.length + tasks.overdue.length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Hola, {user.name.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          {total === 0 ? 'No tienes tareas pendientes' : `${total} tarea${total !== 1 ? 's' : ''} activa${total !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* KPI Bar */}
      <TeamKPIBar kpis={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Columna izquierda: Tareas */}
        <div className="lg:col-span-2 space-y-8">
          {tasks.overdue.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Atrasadas ({tasks.overdue.length})
              </h2>
              <div className="grid gap-2">{tasks.overdue.map(t => <TaskCard key={t.id} task={t} overdue />)}</div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Hoy ({tasks.today.length})
            </h2>
            {tasks.today.length === 0
              ? <p className="text-slate-400 text-sm">Sin vencimientos hoy</p>
              : <div className="grid gap-2">{tasks.today.map(t => <TaskCard key={t.id} task={t} />)}</div>
            }
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
              Pendientes ({tasks.pending.length})
            </h2>
            {tasks.pending.length === 0
              ? <p className="text-slate-400 text-sm">Sin tareas pendientes</p>
              : <div className="grid gap-2">{tasks.pending.map(t => <TaskCard key={t.id} task={t} />)}</div>
            }
          </section>
        </div>

        {/* Columna derecha: Progress */}
        <div>
          <ProjectsProgressWidget data={progress} title="Mis proyectos" />
        </div>
      </div>
    </div>
  )
}
