import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { Project, User, ProjectMember, ProjectFile, ProjectHistoryEntry, ProjectMetrics } from '@/types'
import { ProjectDetailClient } from '@/components/projects/detail/ProjectDetailClient'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function apiFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { Cookie: `token=${token}` }, cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

interface HistoryData { entries: ProjectHistoryEntry[]; total: number; hasMore: boolean }

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getServerUser()
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''

  const [project, metrics, members, files, historyData, users] = await Promise.all([
    apiFetch<Project>(`/api/projects/${id}`, token),
    apiFetch<ProjectMetrics>(`/api/projects/${id}/metrics`, token),
    apiFetch<ProjectMember[]>(`/api/projects/${id}/members`, token),
    apiFetch<ProjectFile[]>(`/api/projects/${id}/files`, token),
    apiFetch<HistoryData>(`/api/projects/${id}/history?limit=20`, token),
    user?.role === 'ADMIN' ? apiFetch<User[]>('/api/users', token) : Promise.resolve<User[] | null>([]),
  ])

  if (!project) notFound()

  const defaultMetrics: ProjectMetrics = { progressPct: 0, tasksByStatus: {}, tasksTotal: 0, tasksCompleted: 0, tasksUnassigned: 0, tasksOverdue: 0, activeMembers: 0 }
  const defaultHistory: HistoryData = { entries: [], total: 0, hasMore: false }

  return (
    <ProjectDetailClient
      project={project}
      metrics={metrics ?? defaultMetrics}
      members={members ?? []}
      files={files ?? []}
      historyData={historyData ?? defaultHistory}
      users={users ?? []}
      currentUserId={user?.id ?? ''}
      isAdmin={user?.role === 'ADMIN'}
    />
  )
}
