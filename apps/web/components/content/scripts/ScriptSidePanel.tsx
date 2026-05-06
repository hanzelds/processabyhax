'use client'

import { useState, useEffect, useRef } from 'react'
import { Script, ScriptVersion, ScriptComment, User } from '@/types'
import { api } from '@/lib/api'
import { FileText, History, MessageSquare, RotateCcw, Send, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type PanelType = 'brief' | 'versions' | 'comments'

interface Props {
  script: Script & { versions?: ScriptVersion[]; comments?: ScriptComment[] }
  panel: PanelType
  me: User
  users: User[]
  onVersionRestore: (v: ScriptVersion) => Promise<void>
}

export function ScriptSidePanel({ script, panel, me, users, onVersionRestore }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-slate-100 flex-shrink-0">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          {panel === 'brief' && <><FileText className="w-4 h-4 text-slate-400" /> Brief</>}
          {panel === 'versions' && <><History className="w-4 h-4 text-slate-400" /> Versiones</>}
          {panel === 'comments' && <><MessageSquare className="w-4 h-4 text-slate-400" /> Comentarios</>}
        </h3>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-auto">
        {panel === 'brief' && <BriefPanel script={script} />}
        {panel === 'versions' && <VersionsPanel script={script} onRestore={onVersionRestore} me={me} />}
        {panel === 'comments' && <CommentsPanel script={script} me={me} users={users} />}
      </div>
    </div>
  )
}

// ── Brief panel ───────────────────────────────────────────────────────────────

function BriefPanel({ script }: { script: Script }) {
  const b = script.brief
  return (
    <div className="p-4 space-y-4 text-sm">
      <div>
        <Link
          href={`/content/briefs?clientId=${script.clientId}`}
          className="font-semibold text-[#17394f] hover:underline"
        >
          {b.title}
        </Link>
        <p className="text-xs text-slate-400 mt-0.5">{script.client.name}</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Tipo:</span>
        <span className="text-xs font-medium text-slate-700 capitalize">{script.type}</span>
      </div>

      {b.concept && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Concepto</p>
          <p className="text-slate-700 whitespace-pre-line leading-relaxed">{b.concept}</p>
        </div>
      )}

      {b.script && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Guion del brief</p>
          <p className="text-slate-600 whitespace-pre-line leading-relaxed text-xs">{b.script}</p>
        </div>
      )}

      {!b.concept && !b.script && (
        <p className="text-slate-400 text-xs italic">El brief no tiene concepto ni guion aún.</p>
      )}
    </div>
  )
}

// ── Versions panel ────────────────────────────────────────────────────────────

function VersionsPanel({ script, onRestore, me }: { script: Script & { versions?: ScriptVersion[] }; onRestore: (v: ScriptVersion) => Promise<void>; me: User }) {
  const [versions, setVersions] = useState<ScriptVersion[]>(script.versions ?? [])
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const isAdmin = me.role === 'ADMIN' || me.role === 'LEAD'

  async function saveVersion() {
    setSaving(true)
    try {
      const v = await api.post<ScriptVersion>(`/api/scripts/${script.id}/versions`, { notes: note || undefined })
      setVersions(prev => [v, ...prev])
      setNote('')
    } catch { /* noop */ }
    finally { setSaving(false) }
  }

  async function restore(v: ScriptVersion) {
    if (!confirm(`¿Restaurar versión ${v.version}? El contenido actual se perderá.`)) return
    setRestoring(v.id)
    try { await onRestore(v) } catch { /* noop */ }
    finally { setRestoring(null) }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Save version */}
      <div className="p-4 border-b border-slate-100">
        <p className="text-xs text-slate-500 mb-2">Guarda un snapshot del estado actual</p>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Nota opcional..."
          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#17394f]/20 mb-2"
          onKeyDown={e => e.key === 'Enter' && saveVersion()}
        />
        <button
          onClick={saveVersion}
          disabled={saving}
          className="w-full bg-[#17394f] text-white text-xs py-1.5 rounded-lg hover:bg-[#17394f]/90 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar versión'}
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-auto divide-y divide-slate-100">
        {versions.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">Sin versiones guardadas</p>
        ) : versions.map(v => (
          <div key={v.id} className="p-3 hover:bg-slate-50">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-700">v{v.version} — {v.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {v.savedBy.name} · {new Date(v.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
                {v.notes && <p className="text-xs text-slate-500 mt-1 italic">{v.notes}</p>}
              </div>
              {isAdmin && (
                <button
                  onClick={() => restore(v)}
                  disabled={restoring === v.id}
                  title="Restaurar esta versión"
                  className="text-slate-400 hover:text-[#17394f] transition-colors flex-shrink-0 mt-0.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Comments panel ────────────────────────────────────────────────────────────

function CommentsPanel({ script, me, users }: { script: Script & { comments?: ScriptComment[] }; me: User; users: User[] }) {
  const [comments, setComments] = useState<ScriptComment[]>(script.comments ?? [])
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [posting, setPosting] = useState(false)

  async function postComment(content: string, parentId?: string) {
    if (!content.trim()) return
    setPosting(true)
    try {
      const comment = await api.post<ScriptComment>(`/api/scripts/${script.id}/comments`, {
        content: content.trim(),
        parentId: parentId ?? null,
      })
      if (parentId) {
        setComments(prev => prev.map(c => c.id === parentId
          ? { ...c, replies: [...(c.replies ?? []), comment] }
          : c
        ))
        setReplyTo(null); setReplyDraft('')
      } else {
        setComments(prev => [comment, ...prev])
        setDraft('')
      }
    } catch { /* noop */ }
    finally { setPosting(false) }
  }

  async function resolve(id: string) {
    try {
      await api.patch(`/api/scripts/${script.id}/comments/${id}/resolve`, {})
      setComments(prev => prev.map(c => c.id === id ? { ...c, isResolved: true } : c))
    } catch { /* noop */ }
  }

  const isAdmin = me.role === 'ADMIN' || me.role === 'LEAD'

  return (
    <div className="flex flex-col h-full">
      {/* Comment input */}
      <div className="p-3 border-b border-slate-100">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Escribe un comentario..."
          rows={2}
          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#17394f]/20 resize-none"
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment(draft) }}
        />
        <div className="flex justify-end mt-1.5">
          <button
            onClick={() => postComment(draft)}
            disabled={!draft.trim() || posting}
            className="flex items-center gap-1 bg-[#17394f] text-white text-xs px-3 py-1.5 rounded-lg hover:bg-[#17394f]/90 disabled:opacity-50"
          >
            <Send className="w-3 h-3" />
            Enviar
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-auto divide-y divide-slate-100">
        {comments.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">Sin comentarios aún</p>
        ) : comments.map(c => (
          <div key={c.id} className={`p-3 ${c.isResolved ? 'opacity-50' : ''}`}>
            {/* Main comment */}
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-[#17394f]/20 text-[#17394f] text-xs flex items-center justify-center font-bold flex-shrink-0">
                {c.author.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-700">{c.author.name}</span>
                  <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}</span>
                  {c.isResolved && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                </div>
                <p className="text-xs text-slate-700 mt-0.5 whitespace-pre-line">{c.content}</p>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setReplyTo(c.id === replyTo ? null : c.id)}
                    className="text-xs text-slate-400 hover:text-[#17394f]"
                  >
                    Responder
                  </button>
                  {!c.isResolved && (isAdmin || c.authorId === me.id) && (
                    <button onClick={() => resolve(c.id)} className="text-xs text-slate-400 hover:text-emerald-600">
                      Resolver
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Replies */}
            {(c.replies ?? []).length > 0 && (
              <div className="ml-8 mt-2 space-y-2">
                {(c.replies ?? []).map(r => (
                  <div key={r.id} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-xs flex items-center justify-center font-bold flex-shrink-0">
                      {r.author.name[0].toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-600">{r.author.name}</span>
                      <p className="text-xs text-slate-600 mt-0.5">{r.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reply input */}
            {replyTo === c.id && (
              <div className="ml-8 mt-2">
                <textarea
                  value={replyDraft}
                  onChange={e => setReplyDraft(e.target.value)}
                  placeholder="Tu respuesta..."
                  rows={2}
                  autoFocus
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#17394f]/20 resize-none"
                />
                <div className="flex gap-1 mt-1">
                  <button onClick={() => { setReplyTo(null); setReplyDraft('') }} className="text-xs text-slate-400 px-2 py-1 rounded hover:bg-slate-100">
                    Cancelar
                  </button>
                  <button
                    onClick={() => postComment(replyDraft, c.id)}
                    disabled={!replyDraft.trim() || posting}
                    className="text-xs bg-[#17394f] text-white px-2 py-1 rounded hover:bg-[#17394f]/90 disabled:opacity-50"
                  >
                    Enviar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
