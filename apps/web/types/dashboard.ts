export interface AdminKPIs {
  activeProjects: number
  tasksInProgress: number
  tasksOverdue: number
  tasksBlocked: number
}

export interface WorkloadEntry {
  userId: string
  name: string
  area?: string | null
  totalActive: number
  inProgress: number
  overdue: number
  blocked: number
  loadPct: number
}

export interface ProjectProgress {
  projectId: string
  projectName: string
  clientName: string
  status: string
  tasksTotal: number
  tasksCompleted: number
  progressPct: number
  estimatedClose?: string | null
  daysRemaining?: number | null
  isOverdue: boolean
  isUrgent: boolean
  noTasks: boolean
  suggestClose: boolean
}

export interface ActivityEntry {
  id: string
  actorName: string
  eventType: string
  entityType: string
  entityName: string
  meta: Record<string, unknown>
  createdAt: string
  relativeTime: string
}

export interface ActivityFeedResponse {
  entries: ActivityEntry[]
  total: number
  hasMore: boolean
}

export interface TeamKPIs {
  // Estado
  todayCount: number
  inProgress: number
  overdue: number
  blocked: number
  // Rendimiento
  completedWeek: number
  completedMonth: number
  completionRatePct: number
  streakDays: number
  // Carga
  dueThisWeek: number
  activeProjects: number
}

export interface LeadMember {
  id: string
  name: string
  area?: string | null
  load?: number
  overdueCount?: number
}

export interface LeadKPIs {
  projects: {
    active: number
    atRisk: number
    overdue: number
    avgProgressPct: number
    deliveryRatePct: number
  }
  team: {
    totalMembers: number
    availableMembers: number
    overdueTasksCount: number
    blockedTasksCount: number
    mostLoadedMember: LeadMember | null
    overdueMembers: LeadMember[]
  }
}
