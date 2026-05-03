import { getServerUser } from '@/lib/auth'
import { cookies } from 'next/headers'
import { AdminDashboard } from '@/components/dashboard/AdminDashboard'
import { TeamDashboard } from '@/components/dashboard/TeamDashboard'
import { LeadDashboard } from '@/components/dashboard/LeadDashboard'
import {
  AdminKPIs,
  WorkloadEntry,
  ProjectProgress,
  ActivityFeedResponse,
  TeamKPIs,
  LeadKPIs,
} from '@/types/dashboard'
import { Task, AdminTaskAlerts } from '@/types'

const API = process.env.API_INTERNAL_URL || 'http://localhost:4100'

async function apiFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Cookie: `token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}

interface MyTasks { today: Task[]; pending: Task[]; overdue: Task[] }

const EMPTY_TEAM_KPIS: TeamKPIs = {
  todayCount: 0, inProgress: 0, overdue: 0, blocked: 0,
  completedWeek: 0, completedMonth: 0, completionRatePct: 100,
  streakDays: 0, dueThisWeek: 0, activeProjects: 0,
}

const EMPTY_LEAD_KPIS: LeadKPIs = {
  projects: { active: 0, atRisk: 0, overdue: 0, avgProgressPct: 0, deliveryRatePct: 100 },
  team: { totalMembers: 0, availableMembers: 0, overdueTasksCount: 0, blockedTasksCount: 0, mostLoadedMember: null, overdueMembers: [] },
}

export default async function DashboardPage() {
  const user = await getServerUser()
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value || ''

  if (!user) return null

  // ── ADMIN ──────────────────────────────────────────────────────────────────
  if (user.role === 'ADMIN') {
    const [kpis, workload, progress, activity, myTasksData, adminAlerts] = await Promise.all([
      apiFetch<AdminKPIs>('/api/dashboard/admin/kpis', token),
      apiFetch<WorkloadEntry[]>('/api/dashboard/admin/workload', token),
      apiFetch<ProjectProgress[]>('/api/dashboard/admin/projects-progress', token),
      apiFetch<ActivityFeedResponse>('/api/dashboard/admin/activity?limit=20', token),
      apiFetch<MyTasks>('/api/tasks/my', token),
      apiFetch<AdminTaskAlerts>('/api/admin/tasks/alerts', token),
    ])

    return (
      <AdminDashboard
        kpis={kpis ?? { activeProjects: 0, tasksInProgress: 0, tasksOverdue: 0, tasksBlocked: 0 }}
        workload={workload ?? []}
        progress={progress ?? []}
        activity={activity ?? { entries: [], hasMore: false, total: 0 }}
        myTasks={myTasksData ?? { today: [], pending: [], overdue: [] }}
        adminAlerts={adminAlerts ?? { overdue: 0, dueSoon: 0, blocked: 0 }}
      />
    )
  }

  // ── LEAD ───────────────────────────────────────────────────────────────────
  if (user.role === 'LEAD') {
    const [leadKpis, teamKpis, tasks, progress] = await Promise.all([
      apiFetch<LeadKPIs>('/api/dashboard/lead/kpis', token),
      apiFetch<TeamKPIs>('/api/dashboard/team/kpis', token),
      apiFetch<MyTasks>('/api/tasks/my', token),
      apiFetch<ProjectProgress[]>('/api/dashboard/team/projects-progress', token),
    ])

    return (
      <LeadDashboard
        user={user}
        leadKpis={leadKpis ?? EMPTY_LEAD_KPIS}
        teamKpis={teamKpis ?? EMPTY_TEAM_KPIS}
        tasks={tasks ?? { today: [], pending: [], overdue: [] }}
        progress={progress ?? []}
      />
    )
  }

  // ── TEAM ───────────────────────────────────────────────────────────────────
  const [kpis, tasks, progress] = await Promise.all([
    apiFetch<TeamKPIs>('/api/dashboard/team/kpis', token),
    apiFetch<MyTasks>('/api/tasks/my', token),
    apiFetch<ProjectProgress[]>('/api/dashboard/team/projects-progress', token),
  ])

  return (
    <TeamDashboard
      user={user}
      kpis={kpis ?? EMPTY_TEAM_KPIS}
      tasks={tasks ?? { today: [], pending: [], overdue: [] }}
      progress={progress ?? []}
    />
  )
}
