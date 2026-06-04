'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { User } from '@/types'
import { MessageCircle, Check, Trash2, ChevronDown, ChevronUp, Send, Loader2 } from 'lucide-react'

interface Comment {
  id: string
  content: string
  blockId: string | null
  parentId: string | null
  resolved: boolean
  createdAt: string
  author: { id: string; name: string; avatarUrl?: string | null }
  replies: Comment[]
}

interface Props {
  pageId: string
  currentUserId: string
  isAdmin: boolean
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Avatar({ user }: { user: { name: string; avatarUrl?: string | null } }) {
  const initials = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return user.avatarUrl
    ? <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
    : <div className="w-7 h-7 rounded-full bg-[#17394f] flex items-center justify-center text-white text-[10px] font-semibold shrink-0">{initials}</div>
}

export function CommentsPanel({ pageId, currentUserId, isAdmin }: Props) {
  const [comments, setComments]         = useState<Comment[]>([])
  const [loading, setLoading]           = useState(true)
  const [newText, setNewText]           = useState('')
  const [saving, setSaving]             = useState(false)
  const [expanded, setExpanded]         = useState<Set<string>>(new Set())
  const [replyTo, setReplyTo]           = useState<string | null>(null)
  const [replyText, setReplyText]       = useState('')
  const [showResolved, setShowResolved] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.get<Comment[]>(`/api/docs/pages/${pageId}/comments`)
      setComments(data)
    } finally { setLoading(false) }
  }, [pageId])

  useEffect(() => { load() }, [load])

  async function addComment(content: string, parentId?: string) {
    if (!content.trim()) return
    setSaving(true)
    try {
      const c = await api.post<Comment>(`/api/docs/pages/${pageId}/comments`, { content, parentId })
      if (parentId) {
        setComments(prev => prev.map(cm => cm.id === parentId ? { ...cm, replies: [...cm.replies, c] } : cm))
        setReplyTo(null); setReplyText('')
      } else {
        setComments(prev => [...prev, c])
        setNewText('')
      }
    } finally { setSaving(false) }
  }

  async function resolve(id: string, resolved: boolean) {
    const c = await api.patch<Comment>(`/api/docs/pages/${pageId}/comments/${id}`, { resolved })
    setComments(prev => prev.map(cm => cm.id === id ? { ...cm, resolved: c.resolved } : cm))
  }

  async function deleteComment(id: string, parentId?: string) {
    await api.delete(`/api/docs/pages/${pageId}/comments/${id}`)
    if (parentId) {
      setComments(prev => prev.map(cm => cm.id === parentId ? { ...cm, replies: cm.replies.filter(r => r.id !== id) } : cm))
    } else {
      setComments(prev => prev.filter(cm => cm.id !== id))
    }
  }

  const visible = comments.filter(c => showResolved ? true : !c.resolved)
  const resolvedCount = comments.filter(c => c.resolved).length

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#17394f]" />
          <span className="text-sm font-semibold text-slate-800">Comentarios</span>
          <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{comments.filter(c => !c.resolved).length}</span>
        </div>
        {resolvedCount > 0 && (
          <button onClick={() => setShowResolved(p => !p)} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            {showResolved ? 'Ocultar' : `Ver ${resolvedCount} resueltos`}
          </button>
        )}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {visible.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Sin comentarios aún</p>
        )}

        {visible.map(c => (
          <div key={c.id} className={`rounded-xl border p-3 space-y-2 ${c.resolved ? 'border-slate-100 bg-slate-50/50 opacity-60' : 'border-slate-200 bg-white'}`}>
            {/* Comment header */}
            <div className="flex items-start gap-2">
              <Avatar user={c.author} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700">{c.author.name}</span>
                  <span className="text-[10px] text-slate-400">{formatDate(c.createdAt)}</span>
                  {c.resolved && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">Resuelto</span>}
                </div>
                <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{c.content}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pl-9">
              <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="text-[11px] text-slate-400 hover:text-[#17394f] transition-colors">
                Responder
              </button>
              <button onClick={() => resolve(c.id, !c.resolved)} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-600 transition-colors">
                <Check className="w-3 h-3" /> {c.resolved ? 'Reabrir' : 'Resolver'}
              </button>
              {(c.author.id === currentUserId || isAdmin) && (
                <button onClick={() => deleteComment(c.id)} className="text-[11px] text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              {c.replies.length > 0 && (
                <button onClick={() => setExpanded(s => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors ml-auto">
                  {expanded.has(c.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {c.replies.length} respuesta{c.replies.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>

            {/* Replies */}
            {(expanded.has(c.id) || replyTo === c.id) && (
              <div className="pl-9 space-y-2 border-l border-slate-100 ml-3.5">
                {expanded.has(c.id) && c.replies.map(r => (
                  <div key={r.id} className="flex items-start gap-2">
                    <Avatar user={r.author} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">{r.author.name}</span>
                        <span className="text-[10px] text-slate-400">{formatDate(r.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-700 mt-0.5">{r.content}</p>
                    </div>
                    {(r.author.id === currentUserId || isAdmin) && (
                      <button onClick={() => deleteComment(r.id, c.id)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}

                {replyTo === c.id && (
                  <div className="flex gap-2 pt-1">
                    <textarea
                      autoFocus
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment(replyText, c.id) }}
                      rows={2}
                      placeholder="Escribe una respuesta…"
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 resize-none outline-none focus:border-[#17394f]"
                    />
                    <button onClick={() => addComment(replyText, c.id)} disabled={saving || !replyText.trim()} className="self-end w-8 h-8 bg-[#17394f] text-white rounded-lg flex items-center justify-center hover:bg-[#1e4a65] disabled:opacity-50 transition-colors shrink-0">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New comment input */}
      <div className="px-4 py-3 border-t border-slate-100">
        <div className="flex gap-2">
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment(newText) }}
            rows={2}
            placeholder="Escribe un comentario… (⌘+Enter para enviar)"
            className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f]/20"
          />
          <button onClick={() => addComment(newText)} disabled={saving || !newText.trim()} className="self-end w-9 h-9 bg-[#17394f] text-white rounded-xl flex items-center justify-center hover:bg-[#1e4a65] disabled:opacity-50 transition-colors shrink-0">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
