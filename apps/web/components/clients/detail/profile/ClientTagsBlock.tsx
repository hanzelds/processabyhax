'use client'

import { useState, useRef } from 'react'
import { Tag } from '@/types'
import { api } from '@/lib/api'

interface Props {
  clientId: string
  initialTags: Tag[]
}

export function ClientTagsBlock({ clientId, initialTags }: Props) {
  const [tags, setTags]           = useState(initialTags)
  const [input, setInput]         = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [saving, setSaving]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function loadSuggestions(q: string) {
    if (!q.trim()) { setSuggestions([]); return }
    const all = await api.get<Tag[]>('/api/clients/tags/all')
    const existing = new Set(tags.map(t => t.id))
    setSuggestions(all.filter(t => t.name.includes(q.toLowerCase()) && !existing.has(t.id)).slice(0, 6))
  }

  async function addTag(name: string) {
    const trimmed = name.trim().toLowerCase()
    if (!trimmed || tags.find(t => t.name === trimmed)) return
    setSaving(true)
    try {
      const tag = await api.post<Tag>(`/api/clients/${clientId}/tags`, { name: trimmed })
      setTags(prev => [...prev, tag])
      setInput(''); setSuggestions([])
    } finally { setSaving(false) }
  }

  async function removeTag(id: string) {
    await api.delete(`/api/clients/${clientId}/tags/${id}`)
    setTags(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-900 mb-3">Etiquetas</h3>

      <div className="flex flex-wrap gap-2 mb-3">
        {tags.map(t => (
          <span key={t.id} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
            {t.name}
            <button onClick={() => removeTag(t.id)} className="text-slate-400 hover:text-red-400 transition-colors leading-none">✕</button>
          </span>
        ))}
        {tags.length === 0 && <p className="text-xs text-slate-400">Sin etiquetas</p>}
      </div>

      {tags.length < 10 && (
        <div className="relative">
          <input
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); loadSuggestions(e.target.value) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(input) } }}
            placeholder="Agregar etiqueta (Enter para confirmar)"
            disabled={saving}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-10 mt-1">
              {suggestions.map(s => (
                <button key={s.id} onClick={() => addTag(s.name)} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-slate-400 mt-1.5">{tags.length}/10 etiquetas</p>
    </div>
  )
}
