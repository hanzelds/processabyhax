import { TaskStatus, ProjectStatus, ClientStatus, ClientTier, Role, UserStatus } from '@/types'

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
}

export function isOverdue(dueDate: string | null | undefined, status: TaskStatus): boolean {
  if (!dueDate || status === 'COMPLETED') return false
  return new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0))
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW: 'En revisión',
  COMPLETED: 'Completado',
  BLOCKED: 'Bloqueado',
}

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  IN_REVIEW: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  BLOCKED: 'bg-red-100 text-red-600',
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: 'Activo',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completado',
}

export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  ACTIVE: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
}

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  POTENTIAL: 'Potencial',
}

export const CLIENT_STATUS_COLOR: Record<ClientStatus, string> = {
  ACTIVE:    'bg-emerald-100 text-emerald-700',
  INACTIVE:  'bg-slate-100 text-slate-500',
  POTENTIAL: 'bg-blue-100 text-blue-700',
}

export const CLIENT_TIER_LABEL: Record<ClientTier, string> = {
  STRATEGIC: 'Estratégico',
  REGULAR:   'Regular',
  PUNCTUAL:  'Puntual',
  POTENTIAL: 'Potencial',
}

export const CLIENT_TIER_COLOR: Record<ClientTier, string> = {
  STRATEGIC: 'bg-purple-100 text-purple-700',
  REGULAR:   'bg-brand-100 text-brand-700',
  PUNCTUAL:  'bg-slate-100 text-slate-600',
  POTENTIAL: 'bg-emerald-100 text-emerald-700',
}

export const USER_ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  LEAD:  'Lead',
  TEAM:  'Team',
}

export const USER_ROLE_COLOR: Record<Role, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  LEAD:  'bg-brand-100 text-brand-700',
  TEAM:  'bg-slate-100 text-slate-600',
}

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  INVITED:   'Invitado',
  ACTIVE:    'Activo',
  SUSPENDED: 'Suspendido',
  INACTIVE:  'Inactivo',
}

export const USER_STATUS_COLOR: Record<UserStatus, string> = {
  INVITED:   'bg-amber-100 text-amber-700',
  ACTIVE:    'bg-emerald-100 text-emerald-700',
  SUSPENDED: 'bg-red-100 text-red-600',
  INACTIVE:  'bg-slate-100 text-slate-400',
}

export const USER_STATUS_DOT: Record<UserStatus, string> = {
  INVITED:   'bg-amber-400',
  ACTIVE:    'bg-emerald-400',
  SUSPENDED: 'bg-red-400',
  INACTIVE:  'bg-slate-300',
}

// ── Task types ────────────────────────────────────────────────────────────────
export const TASK_TYPE_LABEL: Record<string, string> = {
  DISENO:          'Diseño',
  EDICION_VIDEO:   'Edición de video',
  ESTRATEGIA:      'Estrategia',
  PROPUESTA:       'Propuesta',
  PRODUCCION:      'Producción',
  POST_PRODUCCION: 'Post-producción',
  PRE_PRODUCCION:  'Pre-producción',
  COPY:            'Copy',
  FOTOGRAFIA:      'Fotografía',
  CONTENIDO_REDES: 'Contenido redes',
  OTRO:            'Otro',
}

export const TASK_TYPE_OPTIONS = [
  { value: 'DISENO',          label: 'Diseño' },
  { value: 'EDICION_VIDEO',   label: 'Edición de video' },
  { value: 'ESTRATEGIA',      label: 'Estrategia' },
  { value: 'PROPUESTA',       label: 'Propuesta' },
  { value: 'PRODUCCION',      label: 'Producción' },
  { value: 'POST_PRODUCCION', label: 'Post-producción' },
  { value: 'PRE_PRODUCCION',  label: 'Pre-producción' },
  { value: 'COPY',            label: 'Copy' },
  { value: 'FOTOGRAFIA',      label: 'Fotografía' },
  { value: 'CONTENIDO_REDES', label: 'Contenido redes' },
  { value: 'OTRO',            label: 'Otro' },
] as const

export const TASK_TYPE_COLOR: Record<string, string> = {
  DISENO:          'bg-pink-50 text-pink-700',
  EDICION_VIDEO:   'bg-purple-50 text-purple-700',
  ESTRATEGIA:      'bg-blue-50 text-blue-700',
  PROPUESTA:       'bg-indigo-50 text-indigo-700',
  PRODUCCION:      'bg-orange-50 text-orange-700',
  POST_PRODUCCION: 'bg-amber-50 text-amber-700',
  PRE_PRODUCCION:  'bg-yellow-50 text-yellow-700',
  COPY:            'bg-teal-50 text-teal-700',
  FOTOGRAFIA:      'bg-cyan-50 text-cyan-700',
  CONTENIDO_REDES: 'bg-sky-50 text-sky-700',
  OTRO:            'bg-slate-50 text-slate-600',
}
