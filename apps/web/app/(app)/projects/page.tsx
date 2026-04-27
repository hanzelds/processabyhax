import { cookies } from 'next/headers'
import { getServerUser } from '@/lib/auth'
import { Project, DeadlineStatus } from '@/types'
import { NewProjectModal } from '@/components/ui/NewProjectModal'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { PROJECT_STATUS_LABEL } from '@/lib/utils'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function getProjects(token: string): Promise<Project[]> {
  const res = await fetch(`${API}/api/projects`, {
    headers: { Cookie: `token=${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return res.json()
}

export default async function ProjectsPage() {
  const user = await getServerUser()
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''
  const projects = await getProjects(token)

  const grouped = {
    ACTIVE:      projects.filter(p => p.status === 'ACTIVE'),
    IN_PROGRESS: projects.filter(p => p.status === 'IN_PROGRESS'),
    COMPLETED:   projects.filter(p => p.status === 'COMPLETED'),
  }

  const totalActive = grouped.ACTIVE.length + grouped.IN_PROGRESS.length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Proyectos</h1>
          <p className="text-slate-500 text-sm mt-1">
            {totalActive} activo{totalActive !== 1 ? 's' : ''} · {grouped.COMPLETED.length} completado{grouped.COMPLETED.length !== 1 ? 's' : ''}
          </p>
        </div>
        {user?.role === 'ADMIN' && <NewProjectModal />}
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-4xl mb-4">⬡</p>
          <p className="text-lg font-medium text-slate-500">No hay proyectos aún</p>
          <p className="text-sm mt-1">Los proyectos aparecerán aquí cuando sean creados</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(['IN_PROGRESS', 'ACTIVE', 'COMPLETED'] as const).map(status => {
            const list = grouped[status]
            if (list.length === 0) return null
            return (
              <section key={status}>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  {PROJECT_STATUS_LABEL[status]} ({list.length})
                </h2>
                <div className="grid gap-3">
                  {list.map(project => <ProjectCard key={project.id} project={project} />)}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
