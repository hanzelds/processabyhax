'use client'

import { useState } from 'react'
import { ContentPiece, ContentPieceStatus, CopyStatus, ContentType, ContentPlatform, Client } from '@/types'
import {
  PIECE_STATUS_LABEL, PIECE_STATUS_COLOR, COPY_STATUS_LABEL, COPY_STATUS_COLOR,
  CONTENT_TYPE_OPTIONS, PLATFORM_OPTIONS,
} from '@/lib/utils'
import { api } from '@/lib/api'
import { X, CheckCircle, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

const INPUT = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/20'
const LABEL = 'text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide'

const ALL_PIECE_STATUSES: ContentPieceStatus[] = ['listo','programado','publicado','en_revision','pausado','cancelado']
const ALL_COPY_STATUSES: CopyStatus[] = ['pendiente','en_revision','aprobado']

interface Props {
  piece: ContentPiece | null
  defaultDate?: string
  clients: Client[]
  isAdmin: boolean
  onUpdate: (p: ContentPiece) => void
  onCreate?: (p: ContentPiece) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

export function PieceModal({ piece, defaultDate, clients, isAdmin, onUpdate, onCreate, onDelete, onClose }: Props) {
  const isNew = !piece
  const toast   = useToast()
  const confirm = useConfirm()

  const [title, setTitle]         = useState(piece?.title ?? '')
  const [clientId, setClientId]   = useState(piece?.clientId ?? '')
  const [type, setType]           = useState<ContentType>(piece?.type ?? 'reel')
  const [platforms, setPlatforms] = useState<ContentPlatform[]>(piece?.platforms ?? [])
  const [copy, setCopy]           = useState(piece?.copy ?? '')
  const [hashtags, setHashtags]   = useState(piece?.hashtags ?? '')
  const [publicationNotes, setPublicationNotes] = useState(piece?.publicationNotes ?? '')
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(piece?.copyStatus ?? 'pendiente')
  const [status, setStatus]       = useState<ContentPieceStatus>(piece?.status ?? 'listo')
  const [scheduledDate, setScheduledDate] = useState(piece?.scheduledDate?.split('T')[0] ?? defaultDate ?? '')
  const [scheduledTime, setScheduledTime] = useState(piece?.scheduledTime ?? '')

  const [editing, setEditing]     = useState(isNew)
  const [saving, setSaving]       = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [tab, setTab]             = useState<'info'|'copy'|'historial'>('info')

  function togglePlatform(p: ContentPlatform) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  async function handleSave() {
    if (!title.trim() || !clientId || !platforms.length) return
    setSaving(true)
    try {
      if (isNew) {
        const created = await api.post<ContentPiece>('/api/content/pieces', {
          title, clientId, type, platforms, copy: copy || null,
          hashtags: hashtags || null, copyStatus, publicationNotes: publicationNotes || null,
          scheduledDate: scheduledDate || null, scheduledTime: scheduledTime || null,
        })
        onCreate?.(created)
      } else {
        const updated = await api.patch<ContentPiece>(`/api/content/pieces/${piece.id}`, {
          title, copy: copy || null, hashtags: hashtags || null,
          copyStatus, publicationNotes: publicationNotes || null,
        })
        onUpdate(updated)
        setEditing(false)
      }
    } finally { setSaving(false) }
  }

  async function handleSchedule() {
    if (!piece || !scheduledDate) return
    setScheduling(true)
    try {
      const updated = await api.patch<ContentPiece>(`/api/content/pieces/${piece.id}/schedule`, {
        scheduledDate, scheduledTime: scheduledTime || null,
      })
      onUpdate(updated)
    } finally { setScheduling(false) }
  }

  async function handleUnschedule() {
    if (!piece) return
    const updated = await api.patch<ContentPiece>(`/api/content/pieces/${piece.id}/schedule`, {
      scheduledDate: null,
    })
    onUpdate(updated)
  }

  async function handleStatusChange(s: ContentPieceStatus) {
    if (!piece) return
    const updated = await api.patch<ContentPiece>(`/api/content/pieces/${piece.id}/status`, { status: s })
    setStatus(s)
    onUpdate(updated)
  }

  async function handlePublish() {
    if (!piece) return
    setPublishing(true)
    try {
      const updated = await api.patch<ContentPiece>(`/api/content/pieces/${piece.id}/publish`, {})
      onUpdate(updated)
    } finally { setPublishing(false) }
  }

  const canPublish = piece?.status === 'programado' && !isNew

  async function handleDelete() {
    if (!piece) return
    const ok = await confirm({
      title: 'Eliminar pieza',
      message: `¿Eliminar "${piece.title}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    setDeleting(true)
    try {
      await api.delete(`/api/content/pieces/${piece.id}`)
      onDelete?.(piece.id)
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar')
    } finally { setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-slate-900 truncate">{isNew ? 'Nueva pieza' : (editing ? 'Editar pieza' : piece?.title)}</h2>
            {!isNew && !editing && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${PIECE_STATUS_COLOR[status]}`}>
                {PIECE_STATUS_LABEL[status]}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        {!isNew && !editing && (
          <div className="flex border-b border-slate-100 px-6">
            {(['info','copy','historial'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`py-2.5 px-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t ? 'border-[#17394f] text-[#17394f]' : 'border-transparent text-slate-500'
                }`}
              >
                {t === 'info' ? 'Info' : t === 'copy' ? 'Copy' : 'Historial'}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Form */}
          {(isNew || editing) && (
            <>
              <div>
                <label className={LABEL}>Título *</label>
                <input className={INPUT} value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre de la pieza" />
              </div>
              {isNew && (
                <div>
                  <label className={LABEL}>Cliente *</label>
                  <select className={INPUT} value={clientId} onChange={e => setClientId(e.target.value)}>
                    <option value="">Selecciona cliente</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Tipo *</label>
                  <select className={INPUT} value={type} onChange={e => setType(e.target.value as ContentType)}>
                    {CONTENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Estado del copy</label>
                  <select className={INPUT} value={copyStatus} onChange={e => setCopyStatus(e.target.value as CopyStatus)}>
                    {ALL_COPY_STATUSES.map(s => <option key={s} value={s}>{COPY_STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={LABEL}>Plataformas *</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map(p => (
                    <button key={p.value} type="button" onClick={() => togglePlatform(p.value)}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                        platforms.includes(p.value) ? 'bg-[#17394f] text-white border-[#17394f]' : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={LABEL}>Copy / caption</label>
                <textarea className={`${INPUT} resize-none`} rows={3} value={copy} onChange={e => setCopy(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Hashtags</label>
                <input className={INPUT} value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#marca #contenido" />
              </div>
              <div>
                <label className={LABEL}>Notas de publicación</label>
                <textarea className={`${INPUT} resize-none`} rows={2} value={publicationNotes} onChange={e => setPublicationNotes(e.target.value)} placeholder="Instrucciones específicas para quien publica…" />
              </div>
              {isNew && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Fecha de publicación</label>
                    <input type="date" className={INPUT} value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL}>Hora</label>
                    <input type="time" className={INPUT} value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Detail: Info tab */}
          {!isNew && !editing && tab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className={LABEL}>Cliente</p><p className="text-slate-700">{piece?.client.name}</p></div>
                <div><p className={LABEL}>Tipo</p><p className="text-slate-700">{piece?.type}</p></div>
                <div><p className={LABEL}>Plataformas</p><p className="text-slate-700">{piece?.platforms.join(', ')}</p></div>
                <div>
                  <p className={LABEL}>Copy</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COPY_STATUS_COLOR[piece?.copyStatus ?? 'pendiente']}`}>
                    {COPY_STATUS_LABEL[piece?.copyStatus ?? 'pendiente']}
                  </span>
                </div>
              </div>

              {/* Scheduling */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <p className={LABEL}>Programación</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Fecha</label>
                    <input type="date" className={INPUT} value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Hora</label>
                    <input type="time" className={INPUT} value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSchedule} disabled={scheduling || !scheduledDate} className="flex-1 bg-[#17394f] text-white text-sm font-medium rounded-lg py-2 disabled:opacity-50 hover:bg-[#17394f]/90">
                    {scheduling ? 'Guardando…' : scheduledDate ? 'Actualizar fecha' : 'Asignar fecha'}
                  </button>
                  {piece?.scheduledDate && (
                    <button onClick={handleUnschedule} className="px-3 py-2 border border-slate-200 text-slate-500 text-sm rounded-lg hover:bg-slate-50">
                      Quitar fecha
                    </button>
                  )}
                </div>
              </div>

              {/* Status change */}
              {isAdmin && (
                <div>
                  <p className={LABEL}>Estado</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_PIECE_STATUSES.filter(s => s !== 'cancelado').map(s => (
                      <button key={s} onClick={() => handleStatusChange(s)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                          status === s ? PIECE_STATUS_COLOR[s] + ' border-transparent' : 'border-slate-200 text-slate-500'
                        }`}
                      >
                        {PIECE_STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Publication notes */}
              {piece?.publicationNotes && (
                <div>
                  <p className={LABEL}>Notas de publicación</p>
                  <p className="text-sm text-slate-700 bg-yellow-50 border border-yellow-100 rounded-xl p-3">{piece.publicationNotes}</p>
                </div>
              )}

              {/* Brief link */}
              {piece?.brief && (
                <div>
                  <p className={LABEL}>Brief de origen</p>
                  <p className="text-sm text-slate-600">{piece.brief.title}
                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500`}>
                      {piece.brief.status}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Copy tab */}
          {!isNew && !editing && tab === 'copy' && (
            <div className="space-y-4">
              {editing ? null : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className={LABEL}>Caption</p>
                      <select value={copyStatus} onChange={async e => {
                        const s = e.target.value as CopyStatus
                        setCopyStatus(s)
                        const updated = await api.patch<ContentPiece>(`/api/content/pieces/${piece!.id}`, { copyStatus: s })
                        onUpdate(updated)
                      }} className="border border-slate-200 rounded text-xs px-2 py-1">
                        {ALL_COPY_STATUSES.map(s => <option key={s} value={s}>{COPY_STATUS_LABEL[s]}</option>)}
                      </select>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl p-4 min-h-[80px]">
                      {piece?.copy || <span className="text-slate-300">Sin copy</span>}
                    </p>
                  </div>
                  {piece?.hashtags && (
                    <div>
                      <p className={LABEL}>Hashtags</p>
                      <p className="text-sm text-slate-500">{piece.hashtags}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* History tab */}
          {!isNew && !editing && tab === 'historial' && (
            <div className="space-y-2">
              {(piece?.history ?? []).length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">Sin historial</p>
                : (piece?.history ?? []).map(h => (
                  <div key={h.id} className="flex gap-3 py-2 border-b border-slate-100 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm text-slate-700">{h.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{h.actor.name} · {new Date(h.createdAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex items-center gap-3">
          {canPublish && (
            <button onClick={handlePublish} disabled={publishing}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {publishing ? 'Marcando…' : 'Marcar como publicado'}
            </button>
          )}
          {!isNew && !editing && isAdmin && (
            <button onClick={() => setEditing(true)} className="text-sm text-slate-500 hover:text-slate-700">Editar</button>
          )}
          {!isNew && !editing && isAdmin && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Eliminar pieza"
              className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            {(isNew || editing) && (
              <>
                <button onClick={() => isNew ? onClose() : setEditing(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !title.trim() || !clientId || !platforms.length}
                  className="px-4 py-2 text-sm bg-[#17394f] text-white rounded-lg font-medium disabled:opacity-50 hover:bg-[#17394f]/90"
                >
                  {saving ? 'Guardando…' : isNew ? 'Crear pieza' : 'Guardar'}
                </button>
              </>
            )}
            {!isNew && !editing && (
              <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cerrar</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
