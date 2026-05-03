'use client'

import { useState } from 'react'
import { BriefStatus } from '@/types'
import { User, BriefCommentItem } from '@/types'
import { api } from '@/lib/api'
import { CommentForm } from './CommentForm'
import { Loader2 } from 'lucide-react'

const STATUS_LABEL: Partial<Record<BriefStatus, string>> = {
  revision_interna:   'Revisión interna',
  aprobacion_cliente: 'Aprobación del cliente',
  aprobado:           'Aprobado',
  en_produccion:      'En producción',
}

interface Props {
  briefId: string
  newStatus: BriefStatus
  teamUsers: Pick<User, 'id' | 'name'>[]
  onConfirm: (comment?: BriefCommentItem) => void
  onCancel: () => void
}

export function StatusNoteModal({ briefId, newStatus, teamUsers, onConfirm, onCancel }: Props) {
  const [saving, setSaving] = useState(false)

  async function handleConfirm(content: string) {
    setSaving(true)
    try {
      const comment = await api.post<BriefCommentItem>(`/api/briefs/${briefId}/comments/status-note`, {
        content,
        newStatus,
      })
      onConfirm(comment)
    } finally { setSaving(false) }
  }

  async function handleSkip() {
    onConfirm(undefined)
  }

  const label = STATUS_LABEL[newStatus] ?? newStatus

  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h3 className="font-semibold text-slate-900 text-base">
            Cambiar estado a "{label}"
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Puedes dejar una nota para el equipo antes de cambiar el estado.
          </p>
        </div>

        <CommentForm
          placeholder={`Nota para el equipo — p. ej. "Revisar slide 3, el ritmo no fluye. @María"`}
          submitLabel="Cambiar estado"
          onSubmit={handleConfirm}
          onCancel={onCancel}
          autoFocus
          teamUsers={teamUsers}
        />

        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Cancelar
          </button>
          <button
            onClick={handleSkip}
            disabled={saving}
            className="text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
            Cambiar sin nota
          </button>
        </div>
      </div>
    </div>
  )
}
