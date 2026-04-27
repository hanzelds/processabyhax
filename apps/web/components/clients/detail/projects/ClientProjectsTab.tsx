import Link from 'next/link'
import { Project } from '@/types'
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_COLOR, formatDate } from '@/lib/utils'
import { ProjectCard } from '@/components/projects/ProjectCard'

interface Props {
  clientId: string
  projects: Project[]
  isAdmin: boolean
}

export function ClientProjectsTab({ clientId, projects, isAdmin }: Props) {
  const active    = projects.filter(p => p.status !== 'COMPLETED')
  const completed = projects.filter(p => p.status === 'COMPLETED')

  return (
    <div className="space-y-8">
      {/* Active projects */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
            Proyectos activos ({active.length})
          </h3>
          {isAdmin && (
            <Link href={`/projects?client=${clientId}`} className="text-xs font-medium text-brand-700 hover:text-brand-800 transition-colors">
              + Nuevo proyecto
            </Link>
          )}
        </div>
        {active.length === 0
          ? <p className="text-slate-400 text-sm">Sin proyectos activos</p>
          : <div className="grid gap-3">{active.map(p => <ProjectCard key={p.id} project={p} />)}</div>
        }
      </section>

      {/* Completed projects */}
      {completed.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Completados ({completed.length})
          </h3>
          <div className="grid gap-2">
            {completed.map(p => (
              <Link key={p.id} href={`/projects/${p.id}`}
                className="bg-white/60 rounded-xl border border-slate-200 px-4 py-3 hover:bg-white flex items-center justify-between opacity-70 hover:opacity-100 transition-all">
                <div>
                  <p className="text-sm font-medium text-slate-700">{p.name}</p>
                  {p.estimatedClose && <p className="text-xs text-slate-400 mt-0.5">Cerrado: {formatDate(p.estimatedClose)}</p>}
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium shrink-0">Completado</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {projects.length === 0 && (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">Este cliente no tiene proyectos aún</p>
        </div>
      )}
    </div>
  )
}
