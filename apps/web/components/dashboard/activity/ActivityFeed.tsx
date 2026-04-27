'use client'

import { useState } from 'react'
import { ActivityEntry, ActivityFeedResponse } from '@/types/dashboard'
import { api } from '@/lib/api'

const EVENT_ICONS: Record<string, string> = {
  task_created:           '✚',
  task_status_changed:    '⇄',
  task_assigned:          '→',
  project_created:        '⬡',
  project_status_changed: '⬡',
  client_created:         '◉',
  client_status_changed:  '◉',
}

const EVENT_LABELS: Record<string, (e: ActivityEntry) => string> = {
  task_created:           e => `creó la tarea "${e.entityName}"${e.meta?.project_name ? ` en ${e.meta.project_name}` : ''}`,
  task_status_changed:    e => `movió "${e.entityName}" de ${statusLabel(e.meta?.from_status as string)} a ${statusLabel(e.meta?.to_status as string)}`,
  task_assigned:          e => `asignó "${e.entityName}"${e.meta?.project_name ? ` (${e.meta.project_name})` : ''}`,
  project_created:        e => `creó el proyecto "${e.entityName}"${e.meta?.client_name ? ` para ${e.meta.client_name}` : ''}`,
  project_status_changed: e => `cambió "${e.entityName}" a ${statusLabel(e.meta?.to_status as string)}`,
  client_created:         e => `registró al cliente "${e.entityName}"`,
  client_status_changed:  e => `${e.meta?.to_status === 'INACTIVE' ? 'archivó' : 'reactivó'} al cliente "${e.entityName}"`,
}

function statusLabel(s: string): string {
  const map: Record<string, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', IN_REVIEW: 'En revisión', COMPLETED: 'Completado', BLOCKED: 'Bloqueado', ACTIVE: 'Activo', INACTIVE: 'Inactivo' }
  return map[s] || s
}

function EntryRow({ entry }: { entry: ActivityEntry }) {
  const icon = EVENT_ICONS[entry.eventType] || '•'
  const label = EVENT_LABELS[entry.eventType]?.(entry) || entry.eventType
  return (
    <div className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-500 text-sm mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">{entry.actorName}</span>{' '}{label}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{entry.relativeTime}</p>
      </div>
    </div>
  )
}

export function ActivityFeed({ initialData }: { initialData: ActivityFeedResponse }) {
  const [entries, setEntries] = useState<ActivityEntry[]>(initialData.entries)
  const [hasMore, setHasMore] = useState(initialData.hasMore)
  const [loading, setLoading] = useState(false)
  const [eventFilter, setEventFilter] = useState('')

  async function loadMore() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', offset: String(entries.length) })
      if (eventFilter) params.set('event_type', eventFilter)
      const data = await api.get<ActivityFeedResponse>(`/api/dashboard/admin/activity?${params}`)
      setEntries(prev => [...prev, ...data.entries])
      setHasMore(data.hasMore)
    } finally {
      setLoading(false)
    }
  }

  async function applyFilter(filter: string) {
    setEventFilter(filter)
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', offset: '0' })
      if (filter) params.set('event_type', filter)
      const data = await api.get<ActivityFeedResponse>(`/api/dashboard/admin/activity?${params}`)
      setEntries(data.entries)
      setHasMore(data.hasMore)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-slate-900">Actividad reciente</h2>
        <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none" value={eventFilter} onChange={e => applyFilter(e.target.value)}>
          <option value="">Todo</option>
          <option value="task_created">Tareas creadas</option>
          <option value="task_status_changed">Cambios de estado</option>
          <option value="task_assigned">Asignaciones</option>
          <option value="project_created">Proyectos</option>
          <option value="client_created">Clientes</option>
        </select>
      </div>

      {entries.length === 0
        ? <p className="text-slate-400 text-sm py-4 text-center">Sin actividad registrada</p>
        : entries.map(e => <EntryRow key={e.id} entry={e} />)
      }

      {hasMore && (
        <button onClick={loadMore} disabled={loading} className="w-full mt-3 text-sm text-slate-500 hover:text-slate-700 py-2 disabled:opacity-60">
          {loading ? 'Cargando...' : 'Ver más actividad'}
        </button>
      )}
    </div>
  )
}
