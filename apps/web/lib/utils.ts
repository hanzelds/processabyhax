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

// ── Content modules ────────────────────────────────────────────────────────────

import type { BriefStatus, ContentPieceStatus, CopyStatus, ContentType, ContentPlatform, BriefRole } from '@/types'

export const BRIEF_STATUS_LABEL: Record<BriefStatus, string> = {
  idea:               'Idea',
  en_desarrollo:      'En desarrollo',
  revision_interna:   'Revisión interna',
  aprobacion_cliente: 'Aprobación cliente',
  aprobado:           'Aprobado',
  en_produccion:      'En producción',
  en_edicion:         'En edición',
  entregado:          'Entregado',
  cancelado:          'Cancelado',
}

export const BRIEF_STATUS_COLOR: Record<BriefStatus, string> = {
  idea:               'bg-slate-100 text-slate-600',
  en_desarrollo:      'bg-blue-50 text-blue-700',
  revision_interna:   'bg-yellow-50 text-yellow-700',
  aprobacion_cliente: 'bg-orange-50 text-orange-700',
  aprobado:           'bg-teal-50 text-teal-700',
  en_produccion:      'bg-purple-50 text-purple-700',
  en_edicion:         'bg-indigo-50 text-indigo-700',
  entregado:          'bg-emerald-50 text-emerald-700',
  cancelado:          'bg-red-50 text-red-600',
}

export const ALL_BRIEF_STATUSES: BriefStatus[] = [
  'idea','en_desarrollo','revision_interna','aprobacion_cliente',
  'aprobado','en_produccion','en_edicion','entregado','cancelado',
]

export const PIECE_STATUS_LABEL: Record<ContentPieceStatus, string> = {
  listo:      'Listo',
  programado: 'Programado',
  publicado:  'Publicado',
  en_revision:'En revisión',
  en_edicion: 'En edición',
  pausado:    'Pausado',
  cancelado:  'Cancelado',
}

export const PIECE_STATUS_COLOR: Record<ContentPieceStatus, string> = {
  listo:      'bg-teal-50 text-teal-700',
  programado: 'bg-purple-50 text-purple-700',
  publicado:  'bg-emerald-50 text-emerald-700',
  en_revision:'bg-yellow-50 text-yellow-700',
  en_edicion: 'bg-indigo-50 text-indigo-700',
  pausado:    'bg-slate-100 text-slate-500',
  cancelado:  'bg-red-50 text-red-600',
}

export const PIECE_STATUS_DOT: Record<ContentPieceStatus, string> = {
  listo:      'bg-teal-400',
  programado: 'bg-purple-500',
  publicado:  'bg-emerald-500',
  en_revision:'bg-yellow-400',
  en_edicion: 'bg-indigo-400',
  pausado:    'bg-slate-400',
  cancelado:  'bg-red-400',
}

export const COPY_STATUS_LABEL: Record<CopyStatus, string> = {
  pendiente:   'Pendiente',
  en_revision: 'En revisión',
  aprobado:    'Aprobado',
}

export const COPY_STATUS_COLOR: Record<CopyStatus, string> = {
  pendiente:   'bg-orange-50 text-orange-600',
  en_revision: 'bg-yellow-50 text-yellow-700',
  aprobado:    'bg-emerald-50 text-emerald-700',
}

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  reel:     'Reel',
  carrusel: 'Carrusel',
  post:     'Post',
  story:    'Story',
  video:    'Video',
}

export const CONTENT_TYPE_ICON: Record<ContentType, string> = {
  reel:     '🎬',
  carrusel: '🖼️',
  post:     '📸',
  story:    '⭕',
  video:    '📹',
}

export const PLATFORM_LABEL: Record<ContentPlatform, string> = {
  instagram: 'IG',
  tiktok:    'TK',
  facebook:  'FB',
  linkedin:  'LI',
  youtube:   'YT',
}

export const PLATFORM_COLOR: Record<ContentPlatform, string> = {
  instagram: 'bg-pink-50 text-pink-600',
  tiktok:    'bg-slate-800 text-white',
  facebook:  'bg-blue-50 text-blue-700',
  linkedin:  'bg-sky-50 text-sky-700',
  youtube:   'bg-red-50 text-red-600',
}

export const BRIEF_ROLE_LABEL: Record<BriefRole, string> = {
  guionista: 'Guionista',
  productor: 'Productor',
  editor:    'Editor',
  copy:      'Copy',
}

export const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: 'reel',     label: 'Reel' },
  { value: 'carrusel', label: 'Carrusel' },
  { value: 'post',     label: 'Post' },
  { value: 'story',    label: 'Story' },
  { value: 'video',    label: 'Video' },
]

export const PLATFORM_OPTIONS: { value: ContentPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'youtube',   label: 'YouTube' },
]

// ── Client colors ─────────────────────────────────────────────────────────────

export const CLIENT_COLOR_PALETTE = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f43f5e', // rose
  '#f59e0b', // amber
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#ec4899', // pink
  '#10b981', // emerald
  '#ef4444', // red
  '#f97316', // orange
  '#0ea5e9', // sky
  '#a855f7', // purple
  '#17394f', // brand
  '#64748b', // slate
  '#84cc16', // lime
]

/** Returns the client's stored hex color, or a consistent hash-based fallback */
export function clientBgColor(id: string | undefined | null, color?: string | null): string {
  if (color) return color
  if (!id) return CLIENT_COLOR_PALETTE[0]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return CLIENT_COLOR_PALETTE[Math.abs(hash) % CLIENT_COLOR_PALETTE.length]
}

/**
 * Returns true if the hex color is perceptually light and should use dark text.
 * Uses the ITU-R BT.601 luminance formula.
 */
export function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55
}

/** @deprecated use clientBgColor with inline style instead */
export function clientColor(id: string | undefined | null): string {
  const hex = clientBgColor(id)
  const MAP: Record<string, string> = {
    '#3b82f6': 'bg-blue-500', '#8b5cf6': 'bg-violet-500', '#f43f5e': 'bg-rose-500',
    '#f59e0b': 'bg-amber-500', '#14b8a6': 'bg-teal-500', '#06b6d4': 'bg-cyan-500',
    '#6366f1': 'bg-indigo-500', '#ec4899': 'bg-pink-500', '#10b981': 'bg-emerald-500',
    '#ef4444': 'bg-red-500', '#f97316': 'bg-orange-500', '#0ea5e9': 'bg-sky-500',
    '#a855f7': 'bg-purple-500', '#17394f': 'bg-[#17394f]', '#64748b': 'bg-slate-500',
    '#84cc16': 'bg-lime-500',
  }
  return MAP[hex] ?? 'bg-blue-500'
}
