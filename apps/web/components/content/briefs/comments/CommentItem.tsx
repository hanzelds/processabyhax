'use client'

import { useState } from 'react'
import { BriefCommentItem } from '@/types'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { CommentForm } from './CommentForm'
import { CheckCircle, CornerDownRight, Pencil, Trash2 } from 'lucide-react'
import { User } from '@/types'

// ── Render @mentions as colored badges ────────────────────────────────────────

function renderContent(content: string, mentions: BriefCommentItem['mentions']) {
  if (!mentions.length) return <span>{content}</span>
  const names = mentions.map(m => m.user.name)
  const parts = content.split(/(@[\wáéíóúñÁÉÍÓÚÑ\s]+)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const name = part.slice(1).trim()
          const isMention = names.some(n => n.toLowerCase() === name.toLowerCase() || name.toLowerCase().startsWith(n.toLowerCase()))
          if (isMention) {
            return (
              <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#17394f]/10 text-[#17394f] text-xs font-semibold mx-0.5">
                @{name}
              </span>
            )
          }
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

// ── Relative time ─────────────────────────────────────────────────────────────

function relTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)  return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  if (hours < 24) return `hace ${hours}h`
  return `hace ${days}d`
}

// ── Single comment ────────────────────────────────────────────────────────────

interface Props {
  comment: BriefCommentItem
  briefId: string
  currentUserId: string
  isAdminOrLead: boolean
  depth?: number
  teamUsers: Pick<User, 'id' | 'name'>[]
  onUpdate: (c: BriefCommentItem) => void
  onDelete: (id: string) => void
  onReply?: (reply: BriefCommentItem) => void
}

export function CommentItem({ comment, briefId, currentUserId, isAdminOrLead, depth = 0, teamUsers, onUpdate, onDelete, onReply }: Props) {
  const [replying, setReplying] = useState(false)
  const [editing, setEditing]   = useState(false)
  const [resolving, setResolving] = useState(false)
  const toast   = useToast()
  const confirm = useConfirm()

  const isAuthor   = comment.author.id === currentUserId
  const canResolve = isAuthor || isAdminOrLead
  const canEdit    = isAuthor
  const canDelete  = isAuthor || isAdminOrLead
  const minsOld    = (Date.now() - new Date(comment.createdAt).getTime()) / 60000
  const canStillEdit = canEdit && minsOld < 10

  async function handleResolve() {
    setResolving(true)
    try {
      const updated = await api.patch<BriefCommentItem>(`/api/briefs/${briefId}/comments/${comment.id}/resolve`, {})
      onUpdate(updated)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al resolver')
    } finally { setResolving(false) }
  }

  async function handleDelete() {
    const ok = await confirm({ message: '¿Eliminar este comentario?', confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    try {
      await api.delete(`/api/briefs/${briefId}/comments/${comment.id}`)
      onDelete(comment.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  async function handleEdit(content: string) {
    const updated = await api.put<BriefCommentItem>(`/api/briefs/${briefId}/comments/${comment.id}`, { content })
    onUpdate(updated)
    setEditing(false)
  }

  async function handleReply(content: string) {
    const reply = await api.post<BriefCommentItem>(`/api/briefs/${briefId}/comments/${comment.id}/replies`, { content })
    onReply?.(reply)
    setReplying(false)
  }

  const initials = comment.author.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className={`${depth > 0 ? 'ml-8 border-l-2 border-slate-100 pl-4' : ''} ${comment.isResolved ? 'opacity-60' : ''}`}>
      <div className="flex gap-3 py-3">
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-[#17394f]/10 flex items-center justify-center text-[10px] font-bold text-[#17394f] shrink-0 mt-0.5">
          {comment.author.avatarUrl
            ? <img src={comment.author.avatarUrl} className="w-7 h-7 rounded-full object-cover" alt={comment.author.name} />
            : initials}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-800">{comment.author.name}</span>
            <span className="text-[10px] text-slate-400">{relTime(comment.createdAt)}</span>
            {comment.isResolved && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <CheckCircle className="w-3 h-3" />
                Resuelto{comment.resolvedBy ? ` por ${comment.resolvedBy.name}` : ''}
              </span>
            )}
          </div>

          {/* Content or Edit form */}
          {editing ? (
            <div className="mt-2">
              <CommentForm
                placeholder="Edita tu comentario…"
                submitLabel="Guardar"
                onSubmit={handleEdit}
                onCancel={() => setEditing(false)}
                autoFocus
                teamUsers={teamUsers}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-700 mt-1 leading-relaxed whitespace-pre-wrap break-words">
              {renderContent(comment.content, comment.mentions)}
            </p>
          )}

          {/* Actions */}
          {!editing && !comment.isResolved && (
            <div className="flex items-center gap-3 mt-1.5">
              {depth === 0 && onReply && (
                <button onClick={() => setReplying(r => !r)} className="text-[11px] text-slate-400 hover:text-[#17394f] flex items-center gap-1 transition-colors">
                  <CornerDownRight className="w-3 h-3" /> Responder
                </button>
              )}
              {canResolve && (
                <button onClick={handleResolve} disabled={resolving} className="text-[11px] text-slate-400 hover:text-emerald-600 flex items-center gap-1 transition-colors disabled:opacity-50">
                  <CheckCircle className="w-3 h-3" /> {resolving ? 'Resolviendo…' : 'Resolver'}
                </button>
              )}
              {canStillEdit && (
                <button onClick={() => setEditing(true)} className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
              )}
              {canDelete && (
                <button onClick={handleDelete} className="text-[11px] text-slate-300 hover:text-red-500 flex items-center gap-1 transition-colors">
                  <Trash2 className="w-3 h-3" /> Eliminar
                </button>
              )}
            </div>
          )}

          {/* Reply form */}
          {replying && (
            <div className="mt-3">
              <CommentForm
                placeholder="Escribe una respuesta… usa @ para mencionar"
                submitLabel="Responder"
                onSubmit={handleReply}
                onCancel={() => setReplying(false)}
                autoFocus
                teamUsers={teamUsers}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
