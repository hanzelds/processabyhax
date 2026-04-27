'use client'

import { useState } from 'react'
import { ProjectHistoryEntry } from '@/types'
import { api } from '@/lib/api'

const EVENT_ICONS: Record<string, string> = {
  project_created:     '⬡',
  status_changed:      '⇄',
  end_date_changed:    '📅',
  member_added:        '→',
  member_removed:      '←',
  task_created:        '✚',
  task_status_changed: '◈',
  file_uploaded:       '↑',
  file_deleted:        '✕',
}

const EVENT_COLORS: Record<string, string> = {
  project_created:     'bg-brand-100 text-brand-700',
  status_changed:      'bg-blue-100 text-blue-700',
  end_date_changed:    'bg-amber-100 text-amber-700',
  member_added:        'bg-emerald-100 text-emerald-700',
  member_removed:      'bg-red-100 text-red-600',
  task_created:        'bg-slate-100 text-slate-600',
  task_status_changed: 'bg-purple-100 text-purple-700',
  file_uploaded:       'bg-slate-100 text-slate-600',
  file_deleted:        'bg-red-100 text-red-600',
}

interface HistoryResponse {
  entries: ProjectHistoryEntry[]
  total: number
  hasMore: boolean
}

interface Props {
  projectId: string
  initialData: HistoryResponse
}

export function ProjectHistoryTab({ projectId, initialData }: Props) {
  const [entries, setEntries] = useState(initialData.entries)
  const [hasMore, setHasMore] = useState(initialData.hasMore)
  const [loading, setLoading] = useState(false)

  async function loadMore() {
    setLoading(true)
    try {
      const data = await api.get<HistoryResponse>(`/api/projects/${projectId}/history?limit=20&offset=${entries.length}`)
      setEntries(prev => [...prev, ...data.entries])
      setHasMore(data.hasMore)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-900 mb-4">Historial del proyecto</h3>

      {entries.length === 0
        ? <p className="text-sm text-slate-400 py-8 text-center">Sin eventos registrados</p>
        : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-100" />

            <div className="space-y-0">
              {entries.map(entry => (
                <div key={entry.id} className="flex gap-3 py-3 relative">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs z-10 ${EVENT_COLORS[entry.eventType] ?? 'bg-slate-100 text-slate-600'}`}>
                    {EVENT_ICONS[entry.eventType] ?? '•'}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">{entry.actor.name}</span>{' '}
                      {entry.description}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{entry.relativeTime}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      }

      {hasMore && (
        <button onClick={loadMore} disabled={loading}
          className="w-full mt-4 py-2 text-sm text-slate-500 hover:text-slate-700 disabled:opacity-60 transition-colors">
          {loading ? 'Cargando…' : 'Ver más'}
        </button>
      )}
    </div>
  )
}
