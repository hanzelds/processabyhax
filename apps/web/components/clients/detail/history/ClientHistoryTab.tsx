'use client'

import { useState } from 'react'
import { ClientHistoryEntry } from '@/types'
import { api } from '@/lib/api'

const EVENT_ICONS: Record<string, string> = {
  client_created:      '◉',
  status_changed:      '⇄',
  tier_changed:        '◈',
  contact_added:       '→',
  contact_removed:     '←',
  contact_set_primary: '★',
  tag_added:           '+',
  tag_removed:         '−',
  project_created:     '⬡',
  project_completed:   '✓',
}

const EVENT_COLORS: Record<string, string> = {
  client_created:      'bg-brand-100 text-brand-700',
  status_changed:      'bg-blue-100 text-blue-700',
  tier_changed:        'bg-purple-100 text-purple-700',
  contact_added:       'bg-emerald-100 text-emerald-700',
  contact_removed:     'bg-red-100 text-red-600',
  contact_set_primary: 'bg-amber-100 text-amber-700',
  tag_added:           'bg-slate-100 text-slate-600',
  tag_removed:         'bg-slate-100 text-slate-500',
  project_created:     'bg-brand-100 text-brand-700',
  project_completed:   'bg-emerald-100 text-emerald-700',
}

interface HistoryData {
  entries: ClientHistoryEntry[]
  total: number
  hasMore: boolean
}

export function ClientHistoryTab({ clientId, initialData }: { clientId: string; initialData: HistoryData }) {
  const [entries, setEntries] = useState(initialData.entries)
  const [hasMore, setHasMore] = useState(initialData.hasMore)
  const [loading, setLoading] = useState(false)

  async function loadMore() {
    setLoading(true)
    try {
      const data = await api.get<HistoryData>(`/api/clients/${clientId}/history?limit=20&offset=${entries.length}`)
      setEntries(prev => [...prev, ...data.entries])
      setHasMore(data.hasMore)
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-2xl">
      <h3 className="font-semibold text-slate-900 mb-4">Historial del cliente</h3>

      {entries.length === 0
        ? <p className="text-sm text-slate-400 py-8 text-center">Sin eventos registrados</p>
        : (
          <div className="relative">
            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-100" />
            {entries.map(entry => (
              <div key={entry.id} className="flex gap-3 py-3 relative">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs z-10 font-medium ${EVENT_COLORS[entry.eventType] ?? 'bg-slate-100 text-slate-600'}`}>
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
        )
      }

      {hasMore && (
        <button onClick={loadMore} disabled={loading} className="w-full mt-4 py-2 text-sm text-slate-500 hover:text-slate-700 disabled:opacity-60 transition-colors">
          {loading ? 'Cargando…' : 'Ver más'}
        </button>
      )}
    </div>
  )
}
