'use client'

import { useState, useEffect } from 'react'
import { BriefCommentItem } from '@/types'
import { User } from '@/types'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { CommentItem } from './CommentItem'
import { CommentForm } from './CommentForm'
import { MessageSquare, Loader2 } from 'lucide-react'

interface Props {
  briefId: string
  currentUserId: string
  isAdminOrLead: boolean
  teamUsers: Pick<User, 'id' | 'name'>[]
}

export function BriefComments({ briefId, currentUserId, isAdminOrLead, teamUsers }: Props) {
  const [comments, setComments]         = useState<BriefCommentItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [showResolved, setShowResolved] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api.get<BriefCommentItem[]>(`/api/briefs/${briefId}/comments`)
      .then(setComments)
      .catch(() => toast.error('Error al cargar comentarios'))
      .finally(() => setLoading(false))
  }, [briefId])

  async function handleNewComment(content: string) {
    const created = await api.post<BriefCommentItem>(`/api/briefs/${briefId}/comments`, { content })
    setComments(prev => [...prev, { ...created, replies: [] }])
  }

  function updateComment(updated: BriefCommentItem) {
    setComments(prev => prev.map(c => {
      if (c.id === updated.id) return { ...updated, replies: c.replies ?? [] }
      return {
        ...c,
        replies: c.replies?.map(r => r.id === updated.id ? updated : r) ?? [],
      }
    }))
  }

  function deleteComment(id: string) {
    setComments(prev => {
      const withoutRoot = prev.filter(c => c.id !== id)
      return withoutRoot.map(c => ({
        ...c,
        replies: c.replies?.filter(r => r.id !== id) ?? [],
      }))
    })
  }

  function addReply(parentId: string, reply: BriefCommentItem) {
    setComments(prev => prev.map(c =>
      c.id === parentId ? { ...c, replies: [...(c.replies ?? []), reply] } : c
    ))
  }

  const rootComments    = comments
  const unresolvedCount = comments.reduce((n, c) => {
    const unresolvedReplies = (c.replies ?? []).filter(r => !r.isResolved).length
    return n + (c.isResolved ? 0 : 1) + unresolvedReplies
  }, 0)
  const resolvedCount = comments.reduce((n, c) => {
    const resolvedReplies = (c.replies ?? []).filter(r => r.isResolved).length
    return n + (c.isResolved ? 1 : 0) + resolvedReplies
  }, 0)

  const visibleComments = showResolved
    ? rootComments
    : rootComments.filter(c => !c.isResolved || (c.replies ?? []).some(r => !r.isResolved))

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">
            Comentarios
            {unresolvedCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#17394f] text-white text-[10px] font-bold">
                {unresolvedCount}
              </span>
            )}
          </span>
        </div>
        {resolvedCount > 0 && (
          <button
            onClick={() => setShowResolved(s => !s)}
            className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showResolved ? 'Ocultar resueltos' : `Mostrar resueltos (${resolvedCount})`}
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
        </div>
      )}

      {/* Comment list */}
      {!loading && (
        <div className="divide-y divide-slate-100">
          {visibleComments.length === 0 && !loading && (
            <p className="text-xs text-slate-400 text-center py-6">Sin comentarios aún. ¡Sé el primero!</p>
          )}
          {visibleComments.map(comment => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                briefId={briefId}
                currentUserId={currentUserId}
                isAdminOrLead={isAdminOrLead}
                depth={0}
                teamUsers={teamUsers}
                onUpdate={updateComment}
                onDelete={deleteComment}
                onReply={(reply) => addReply(comment.id, reply)}
              />
              {/* Replies */}
              {(comment.replies ?? [])
                .filter(r => showResolved || !r.isResolved)
                .map(reply => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    briefId={briefId}
                    currentUserId={currentUserId}
                    isAdminOrLead={isAdminOrLead}
                    depth={1}
                    teamUsers={teamUsers}
                    onUpdate={updateComment}
                    onDelete={deleteComment}
                  />
                ))}
            </div>
          ))}
        </div>
      )}

      {/* New comment form */}
      <CommentForm
        onSubmit={handleNewComment}
        teamUsers={teamUsers}
      />
    </div>
  )
}
