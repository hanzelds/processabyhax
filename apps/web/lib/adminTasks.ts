import { AdminTaskCategory, AdminTaskPriority, AdminTaskStatus, RecurrenceFrequency } from '@/types'

export const CATEGORY_LABEL: Record<AdminTaskCategory, string> = {
  EQUIPO:           'Equipo',
  FINANZAS:         'Finanzas',
  LEGAL_CONTRATOS:  'Legal & Contratos',
  INFRAESTRUCTURA:  'Infraestructura',
  ESTRATEGIA:       'Estrategia',
  OPERACIONES:      'Operaciones',
  OTRO:             'Otro',
}

export const CATEGORY_ICON: Record<AdminTaskCategory, string> = {
  EQUIPO:           '👥',
  FINANZAS:         '💰',
  LEGAL_CONTRATOS:  '📄',
  INFRAESTRUCTURA:  '🖥️',
  ESTRATEGIA:       '🧭',
  OPERACIONES:      '⚙️',
  OTRO:             '📌',
}

export const PRIORITY_LABEL: Record<AdminTaskPriority, string> = {
  URGENTE: 'Urgente',
  ALTA:    'Alta',
  NORMAL:  'Normal',
  BAJA:    'Baja',
}

export const PRIORITY_COLOR: Record<AdminTaskPriority, string> = {
  URGENTE: 'bg-red-100 text-red-700',
  ALTA:    'bg-orange-100 text-orange-700',
  NORMAL:  'bg-slate-100 text-slate-600',
  BAJA:    'bg-slate-50 text-slate-400',
}

export const STATUS_LABEL: Record<AdminTaskStatus, string> = {
  PENDIENTE:   'Pendiente',
  EN_PROGRESO: 'En progreso',
  BLOQUEADA:   'Bloqueada',
  COMPLETADA:  'Completada',
  CANCELADA:   'Cancelada',
}

export const STATUS_COLOR: Record<AdminTaskStatus, string> = {
  PENDIENTE:   'bg-slate-100 text-slate-600',
  EN_PROGRESO: 'bg-blue-100 text-blue-700',
  BLOQUEADA:   'bg-yellow-100 text-yellow-700',
  COMPLETADA:  'bg-green-100 text-green-700',
  CANCELADA:   'bg-slate-100 text-slate-400',
}

export const FREQUENCY_LABEL: Record<RecurrenceFrequency, string> = {
  DIARIO:      'Diario',
  SEMANAL:     'Semanal',
  MENSUAL:     'Mensual',
  TRIMESTRAL:  'Trimestral',
  SEMESTRAL:   'Semestral',
  ANUAL:       'Anual',
}

export const OPEN_STATUSES: AdminTaskStatus[] = ['PENDIENTE', 'EN_PROGRESO', 'BLOQUEADA']
