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
  todayCount: number
  inProgress: number
  overdue: number
  completedWeek: number
}
