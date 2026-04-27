'use client'

import { useState } from 'react'
import { ClientNote } from '@/types'
import { api } from '@/lib/api'

function NoteCard({ note, currentUserId, isAdmin, onPin, onEdit, onDelete }: {
  note: ClientNote
  currentUserId: string
  isAdmin: boolean
  onPin: (id: string) => void
  onEdit: (n: ClientNote) => void
  onDelete: (id: string) => void
}) {
  const canEdit = isAdmin || note.authorId === currentUserId
  const hasChanged = note.updatedAt !== note.createdAt

  return (
    <div className={`rounded-xl p-4 mb-3 border ${note.isPinned ? 'border-brand-200 bg-brand-50' : 'border-slate-100 bg-white'}`}>
      {note.isPinned && (
        <div className="flex items-center gap-1 text-xs text-brand-600 font-medium mb-2">
          <span>📌</span> Fijada
        </div>
      )}
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-medium text-slate-500">{note.author.name}</span>
          <span>·</span>
          <span>{new Date(note.createdAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          {hasChanged && <span className="italic">(editada)</span>}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => onPin(note.id)} className={`text-xs transition-colors ${note.isPinned ? 'text-brand-500 hover:text-slate-400' : 'text-slate-300 hover:text-brand-500'}`} title={note.isPinned ? 'Desfijar' : 'Fijar'}>
              📌
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={() => onEdit(note)} className="text-slate-300 hover:text-slate-500 text-xs transition-colors">✏</button>
              <button onClick={() => onDelete(note.id)} className="text-slate-300 hover:text-red-400 text-xs transition-colors">✕</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface NotesFeedData {
  pinned: ClientNote[]
  notes: ClientNote[]
  total: number
  hasMore: boolean
}

interface Props {
  clientId: string
  initialData: NotesFeedData
  currentUserId: string
  isAdmin: boolean
}

export function ClientNotesTab({ clientId, initialData, currentUserId, isAdmin }: Props) {
  const [pinned, setPinned]   = useState(initialData.pinned)
  const [notes, setNotes]     = useState(initialData.notes)
  const [hasMore, setHasMore] = useState(initialData.hasMore)
  const [loading, setLoading] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving]   = useState(false)
  const [editing, setEditing] = useState<ClientNote | null>(null)
  const [editContent, setEditContent] = useState('')

  async function createNote() {
    if (!newContent.trim()) return
    setSaving(true)
    try {
      const note = await api.post<ClientNote>(`/api/clients/${clientId}/notes`, { content: newContent })
      setNotes(prev => [note, ...prev])
      setNewContent('')
    } finally { setSaving(false) }
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      const updated = await api.put<ClientNote>(`/api/clients/${clientId}/notes/${editing.id}`, { content: editContent })
      if (updated.isPinned) setPinned(prev => prev.map(n => n.id === updated.id ? updated : n))
      else setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
      setEditing(null)
    } finally { setSaving(false) }
  }

  async function togglePin(id: string) {
    const updated = await api.patch<ClientNote>(`/api/clients/${clientId}/notes/${id}/pin`, {})
    // Re-load to reflect pinned/unpinned correctly
    const refreshed = await api.get<NotesFeedData>(`/api/clients/${clientId}/notes`)
    setPinned(refreshed.pinned)
    setNotes(refreshed.notes)
    setHasMore(refreshed.hasMore)
  }

  async function deleteNote(id: string) {
    await api.delete(`/api/clients/${clientId}/notes/${id}`)
    setPinned(prev => prev.filter(n => n.id !== id))
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  async function loadMore() {
    setLoading(true)
    try {
      const data = await api.get<NotesFeedData>(`/api/clients/${clientId}/notes?offset=${notes.length}`)
      setNotes(prev => [...prev, ...data.notes])
      setHasMore(data.hasMore)
    } finally { setLoading(false) }
  }

  const noteProps = { currentUserId, isAdmin, onPin: togglePin, onDelete: deleteNote }

  return (
    <div className="max-w-2xl">
      {/* New note form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
        <textarea
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="Escribe una nota sobre este cliente…"
          rows={3}
          className="w-full text-sm text-slate-700 resize-none focus:outline-none placeholder-slate-300"
        />
        <div className="flex justify-end mt-2">
          <button onClick={createNote} disabled={saving || !newContent.trim()} className="px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-60 transition-colors" style={{ background: '#17394f' }}>
            {saving ? 'Guardando…' : 'Publicar nota'}
          </button>
        </div>
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="mb-2">
          {pinned.map(n => editing?.id === n.id
            ? <EditForm key={n.id} content={editContent} saving={saving} onSave={saveEdit} onCancel={() => setEditing(null)} onChange={setEditContent} />
            : <NoteCard key={n.id} note={n} {...noteProps} onEdit={n => { setEditing(n); setEditContent(n.content) }} />
          )}
        </div>
      )}

      {/* Regular notes */}
      {notes.length === 0 && pinned.length === 0
        ? <p className="text-sm text-slate-400 py-8 text-center">Sin notas. Sé el primero en agregar contexto sobre este cliente.</p>
        : notes.map(n => editing?.id === n.id
          ? <EditForm key={n.id} content={editContent} saving={saving} onSave={saveEdit} onCancel={() => setEditing(null)} onChange={setEditContent} />
          : <NoteCard key={n.id} note={n} {...noteProps} onEdit={n => { setEditing(n); setEditContent(n.content) }} />
        )
      }

      {hasMore && (
        <button onClick={loadMore} disabled={loading} className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 disabled:opacity-60 transition-colors">
          {loading ? 'Cargando…' : 'Ver más notas'}
        </button>
      )}
    </div>
  )
}

function EditForm({ content, saving, onSave, onCancel, onChange }: { content: string; saving: boolean; onSave: () => void; onCancel: () => void; onChange: (v: string) => void }) {
  return (
    <div className="bg-white rounded-xl border border-brand-200 p-4 mb-3">
      <textarea value={content} onChange={e => onChange(e.target.value)} rows={4} className="w-full text-sm text-slate-700 resize-none focus:outline-none border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-400" />
      <div className="flex gap-2 mt-2">
        <button onClick={onSave} disabled={saving} className="px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-60" style={{ background: '#17394f' }}>Guardar</button>
        <button onClick={onCancel} className="px-4 py-1.5 text-sm text-slate-600 rounded-lg bg-slate-100 hover:bg-slate-200">Cancelar</button>
      </div>
    </div>
  )
}
