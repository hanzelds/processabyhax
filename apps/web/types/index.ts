export type Role = 'ADMIN' | 'LEAD' | 'TEAM'
export type TeamspaceVisibility = 'OPEN' | 'CLOSED' | 'PRIVATE'

export interface TeamspaceProject {
  id: string
  name: string
  status: string
  estimatedClose: string | null
}

export interface Teamspace {
  id: string
  name: string
  emoji: string
  visibility: TeamspaceVisibility
  isMember: boolean
  isAdmin: boolean
  projects: TeamspaceProject[]
}
export type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'
export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'POTENTIAL'
export type ClientTier = 'STRATEGIC' | 'REGULAR' | 'PUNCTUAL' | 'POTENTIAL'
export type ProjectStatus = 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED'
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'BLOCKED'
export type TaskType =
  | 'DISENO' | 'EDICION_VIDEO' | 'ESTRATEGIA' | 'PROPUESTA'
  | 'PRODUCCION' | 'POST_PRODUCCION' | 'PRE_PRODUCCION'
  | 'COPY' | 'FOTOGRAFIA' | 'CONTENIDO_REDES' | 'OTRO'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  status: UserStatus
  area?: string | null
  avatarUrl?: string | null
  bio?: string | null
  phone?: string | null
  joinedAt?: string | null
  lastSeenAt?: string | null
  createdAt: string
  skills?: Skill[]
  permissions?: string[]
  // enriched (list endpoint)
  activeTasks?: number
  overdueTasks?: number
  activeSessions?: number
  lastSeenRelative?: string | null
}

export interface Skill {
  id: string
  name: string
}

export interface UserSession {
  id: string
  deviceInfo?: string | null
  ipAddress?: string | null
  createdAt: string
  expiresAt: string
  isCurrentSession: boolean
  relativeTime: string
}

export interface UserPermissionRow {
  permission: string
  label: string
  module: string
  byRole: boolean
  override: boolean | null
  effective: boolean
}

export interface UserMetrics {
  tasksCompletedTotal: number
  tasksCompletedMonth: number
  completionRatePct: number | null
  activeProjects: number
  currentWorkload: number
  overdueTasks: number
  recentActivity: Array<{
    id: string
    eventType: string
    description?: string
    entityName: string
    createdAt: string
    relativeTime: string
  }>
  workByProject: Array<{ projectId: string; projectName: string; clientName: string; count: number }>
}

export interface Client {
  id: string
  name: string
  contactName: string
  contactInfo: string
  status: ClientStatus
  industry?: string | null
  tier: ClientTier
  website?: string | null
  description?: string | null
  relationStart?: string | null
  createdAt: string
  _count?: { projects: number }
  projects?: Project[]
  contacts?: ClientContact[]
  tags?: Tag[]
  // enriched (from list endpoint)
  activeProjects?: number
  totalProjects?: number
  primaryContact?: ClientContact | null
}

export interface ClientContact {
  id: string
  clientId: string
  name: string
  role?: string | null
  email?: string | null
  phone?: string | null
  isPrimary: boolean
  notes?: string | null
  createdAt: string
}

export interface Tag {
  id: string
  name: string
}

export interface ClientNote {
  id: string
  clientId: string
  authorId: string
  author: { id: string; name: string }
  content: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
}

export interface ClientHistoryEntry {
  id: string
  clientId: string
  actorId: string
  actor: { id: string; name: string }
  eventType: string
  description: string
  meta?: Record<string, unknown>
  createdAt: string
  relativeTime: string
}

export interface ClientMetrics {
  totalProjects: number
  activeProjects: number
  completedTasksTotal: number
  overdueTasksActive: number
  monthsAsClient: number | null
  lastProjectDate: string | null
  teamMembersInvolved: number
  topArea: string | null
  tasksByMonth: Array<{ month: string; completed: number }>
  projectsByStatus: Record<string, number>
}

export type DeadlineStatus = 'on_track' | 'urgent' | 'overdue' | 'no_date'
export type RoleInProject = 'lead' | 'executor'
export type ProjectFileType = 'brief' | 'reference' | 'contract' | 'other'

export interface Project {
  id: string
  name: string
  clientId: string
  client?: Pick<Client, 'id' | 'name' | 'status'>
  description?: string | null
  status: ProjectStatus
  startDate: string
  estimatedClose?: string | null
  closedAt?: string | null
  createdAt: string
  tasks?: Task[]
  _count?: { tasks: number }
  // enriched metrics (from enhanced list endpoint)
  tasksTotal?: number
  tasksCompleted?: number
  tasksOverdue?: number
  tasksBlocked?: number
  progressPct?: number
  daysRemaining?: number | null
  deadlineStatus?: DeadlineStatus
  members?: ProjectMemberUser[]
}

export interface ProjectMemberUser {
  id: string
  name: string
  area?: string | null
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  user: ProjectMemberUser & { role?: string }
  roleInProject: RoleInProject
  addedAt: string
  activeTasks?: number
  completedTasks?: number
  nextDue?: { dueDate: string; title: string } | null
  overdueCount?: number
  blockedCount?: number
}

export interface ProjectFile {
  id: string
  projectId: string
  uploadedById: string
  uploader: { id: string; name: string }
  originalName: string
  storedName: string
  fileType: ProjectFileType
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export interface ProjectHistoryEntry {
  id: string
  projectId: string
  actorId: string
  actor: { id: string; name: string }
  eventType: string
  description: string
  meta?: Record<string, unknown>
  createdAt: string
  relativeTime: string
}

export interface ProjectMetrics {
  progressPct: number
  tasksByStatus: Record<string, number>
  tasksTotal: number
  tasksCompleted: number
  tasksUnassigned: number
  tasksOverdue: number
  activeMembers: number
}

export interface Task {
  id: string
  title: string
  description?: string | null
  projectId: string
  project?: Pick<Project, 'id' | 'name'> & { client?: Pick<Client, 'id' | 'name'> }
  assignedTo?: string | null
  assignee?: Pick<User, 'id' | 'name' | 'area'> | null
  status: TaskStatus
  taskType?: TaskType | null
  dueDate?: string | null
  completedAt?: string | null
  createdAt: string
}

export interface DashboardData {
  today: Task[]
  pending: Task[]
  overdue: Task[]
}

// ── Admin Tasks ───────────────────────────────────────────────────────────────

export type AdminTaskCategory =
  | 'EQUIPO' | 'FINANZAS' | 'LEGAL_CONTRATOS'
  | 'INFRAESTRUCTURA' | 'ESTRATEGIA' | 'OPERACIONES' | 'OTRO'

export type AdminTaskPriority = 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAJA'

export type AdminTaskStatus =
  | 'PENDIENTE' | 'EN_PROGRESO' | 'BLOQUEADA' | 'COMPLETADA' | 'CANCELADA'

export type RecurrenceFrequency =
  | 'DIARIO' | 'SEMANAL' | 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'

export interface AdminTaskRecurrence {
  id: string
  title: string
  description?: string | null
  category: AdminTaskCategory
  priority: AdminTaskPriority
  frequency: RecurrenceFrequency
  dayOfMonth?: number | null
  monthOfYear?: number | null
  dayOfWeek?: number | null
  advanceDays: number
  isActive: boolean
  lastGeneratedAt?: string | null
  nextGenerationAt?: string | null
  createdAt: string
  _count?: { tasks: number }
}

export interface AdminTask {
  id: string
  title: string
  description?: string | null
  category: AdminTaskCategory
  priority: AdminTaskPriority
  status: AdminTaskStatus
  dueDate?: string | null
  resolutionNotes?: string | null
  recurrenceId?: string | null
  recurrence?: Pick<AdminTaskRecurrence, 'id' | 'frequency'> | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  daysUntilDue?: number | null
  isOverdue?: boolean
  isDueSoon?: boolean
}

export interface AdminTaskAlerts {
  overdue: number
  dueSoon: number
  blocked: number
}
