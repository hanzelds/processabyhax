'use client'

import { useState, useRef } from 'react'
import { ContentBrief, BriefStatus, BriefRole, Client, User, ContentType, ContentPlatform, BriefCommentItem } from '@/types'
import {
  BRIEF_STATUS_LABEL, BRIEF_STATUS_COLOR, ALL_BRIEF_STATUSES,
  CONTENT_TYPE_OPTIONS, PLATFORM_OPTIONS, BRIEF_ROLE_LABEL,
} from '@/lib/utils'
import { api } from '@/lib/api'
import { X, Plus, Trash2, ChevronDown, ChevronUp, Paperclip, Upload, FileText, Image, Film, Music, Archive, ExternalLink, Download, MessageSquare } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { BriefComments } from './comments/BriefComments'
import { StatusNoteModal } from './comments/StatusNoteModal'

// Always use relative /api path — Next.js rewrites proxy it to localhost:4100
const API_BASE = '/api'

interface BriefFileItem {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  label: string | null
  createdAt: string
  uploader?: { id: string; name: string }
}

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return <Image className="w-4 h-4" />
  if (mime.startsWith('video/')) return <Film className="w-4 h-4" />
  if (mime.startsWith('audio/')) return <Music className="w-4 h-4" />
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar')) return <Archive className="w-4 h-4" />
  return <FileText className="w-4 h-4" />
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isPreviewable(mime: string) {
  return mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('video/')
}

const INPUT = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/20 focus:border-[#17394f]/40'
const LABEL = 'text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wide'

const SCRIPT_HINT: Record<ContentType, string> = {
  reel:     'INTRO (0-3s): Hook\nDESARROLLO (3-45s): Puntos clave\nCTA (últimos 3s): Acción',
  carrusel: 'SLIDE 1: Portada — título\nSLIDE 2-N: Un punto por slide\nSLIDE FINAL: CTA + contacto',
  post:     'Imagen / visual principal\nCopy de acompañamiento\nCTA',
  story:    'Visual principal\nTexto / sticker\nEnlace o CTA',
  video:    'INTRO: Hook\nDESARROLLO: Contenido\nCTA: Cierre',
}

interface Props {
  brief: ContentBrief | null
  defaultStatus?: BriefStatus
  clients: Client[]
  users: User[]
  isAdmin: boolean
  currentUserId: string
  onUpdate: (b: ContentBrief) => void
  onDelete: (id: string) => void
  onCreate?: (b: ContentBrief) => void
  onClose: () => void
}

const STATUS_REQUIRES_NOTE: BriefStatus[] = ['revision_interna', 'aprobacion_cliente', 'aprobado', 'en_produccion']

export function BriefModal({ brief, defaultStatus, clients, users, isAdmin, currentUserId, onUpdate, onDelete, onCreate, onClose }: Props) {
  const isNew   = !brief
  const confirm = useConfirm()

  const [title, setTitle]       = useState(brief?.title ?? '')
  const [clientId, setClientId] = useState(brief?.clientId ?? '')
  const [type, setType]         = useState<ContentType>(brief?.type ?? 'reel')
  const [platforms, setPlatforms] = useState<ContentPlatform[]>(brief?.platforms ?? [])
  const [concept, setConcept]   = useState(brief?.concept ?? '')
  const [script, setScript]     = useState(brief?.script ?? '')
  const [copyDraft, setCopyDraft] = useState(brief?.copyDraft ?? '')
  const [hashtags, setHashtags] = useState(brief?.hashtags ?? '')
  const [technicalNotes, setTechnicalNotes] = useState(brief?.technicalNotes ?? '')
  const [clientApprovalNotes, setClientApprovalNotes] = useState(brief?.clientApprovalNotes ?? '')
  const [referencesUrls, setReferencesUrls] = useState<string[]>(brief?.referencesUrls ?? [])
  const [newRef, setNewRef]     = useState('')
  const [isRecurring, setIsRecurring] = useState(brief?.isRecurring ?? false)
  const [recurrenceFreq, setRecurrenceFreq] = useState(brief?.recurrenceFreq ?? '')
  const [status, setStatus]     = useState<BriefStatus>(brief?.status ?? defaultStatus ?? 'idea')

  // Assignees state
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [assigneeRole, setAssigneeRole]     = useState<BriefRole>('guionista')
  const [assigneeLoading, setAssigneeLoading] = useState(false)
  const [currentAssignees, setCurrentAssignees] = useState(brief?.assignees ?? [])

  const [editing, setEditing]   = useState(isNew)
  const [saving, setSaving]     = useState(false)
  const [tab, setTab]           = useState<'info'|'guion'|'comentarios'|'archivos'|'asignados'|'historial'>('info')
  const [showScript, setShowScript] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<BriefStatus | null>(null)
  const [commentCount, setCommentCount]   = useState<number>(0)

  // Files tab state
  const [files, setFiles]             = useState<BriefFileItem[]>([])
  const [filesLoaded, setFilesLoaded] = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [uploadLabel, setUploadLabel] = useState('')
  const [previewFile, setPreviewFile] = useState<BriefFileItem | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadFiles() {
    if (!brief || filesLoaded) return
    const data = await api.get<BriefFileItem[]>(`/api/briefs/${brief.id}/files`)
    setFiles(data)
    setFilesLoaded(true)
  }

  async function uploadFile(file: File) {
    if (!brief) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      if (uploadLabel.trim()) form.append('label', uploadLabel.trim())
      const res = await fetch(`${API_BASE}/briefs/${brief.id}/files`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Error al subir') }
      const created: BriefFileItem = await res.json()
      setFiles(prev => [...prev, created])
      setUploadLabel('')
    } finally { setUploading(false) }
  }

  async function deleteFile(fileId: string) {
    if (!brief) return
    const ok = await confirm({ message: '¿Eliminar este archivo?', confirmLabel: 'Eliminar', danger: true })
    if (!ok) return
    await api.delete(`/api/briefs/${brief.id}/files/${fileId}`)
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  // No longer locked — admins can edit/delete any brief including entregado/cancelado
  const isLocked = false

  function togglePlatform(p: ContentPlatform) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  async function handleSave() {
    if (!title.trim() || !clientId || !platforms.length) return
    setSaving(true)
    try {
      if (isNew) {
        const created = await api.post<ContentBrief>('/api/briefs', {
          title, clientId, type, platforms, concept, script,
          copyDraft, hashtags, technicalNotes, isRecurring,
          recurrenceFreq: recurrenceFreq || null,
          referencesUrls,
        })
        onCreate?.(created)
      } else {
        const updated = await api.patch<ContentBrief>(`/api/briefs/${brief.id}`, {
          title, type, platforms, concept, script, copyDraft, hashtags,
          technicalNotes, clientApprovalNotes, isRecurring,
          recurrenceFreq: recurrenceFreq || null, referencesUrls,
        })
        onUpdate(updated)
        setEditing(false)
      }
    } finally { setSaving(false) }
  }

  async function changeStatus(s: BriefStatus, skipNote = false) {
    if (!brief) return
    if (!skipNote && STATUS_REQUIRES_NOTE.includes(s) && (isAdmin || users.some(u => u.id === currentUserId))) {
      setPendingStatus(s)
      return
    }
    const updated = await api.patch<ContentBrief>(`/api/briefs/${brief.id}/status`, { status: s })
    setStatus(s)
    onUpdate(updated)
  }

  async function confirmStatusWithNote(comment?: BriefCommentItem) {
    if (!brief || !pendingStatus) return
    const s = pendingStatus
    setPendingStatus(null)
    const updated = await api.patch<ContentBrief>(`/api/briefs/${brief.id}/status`, { status: s })
    setStatus(s)
    onUpdate(updated)
    if (comment) setCommentCount(n => n + 1)
  }

  async function addAssignee() {
    if (!brief || !assigneeUserId) return
    setAssigneeLoading(true)
    try {
      const a = await api.post(`/api/briefs/${brief.id}/assignees`, { userId: assigneeUserId, role: assigneeRole })
      setCurrentAssignees(prev => [...prev, a as typeof prev[0]])
    } finally { setAssigneeLoading(false); setAssigneeUserId('') }
  }

  async function removeAssignee(userId: string, role: string) {
    if (!brief) return
    await api.delete(`/api/briefs/${brief.id}/assignees/${userId}/${role}`)
    setCurrentAssignees(prev => prev.filter(a => !(a.userId === userId && a.role === role)))
  }

  function addRef() {
    if (newRef.trim()) { setReferencesUrls(prev => [...prev, newRef.trim()]); setNewRef('') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-900">{isNew ? 'Nuevo brief' : (editing ? 'Editar brief' : brief?.title)}</h2>
            {!isNew && !editing && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${BRIEF_STATUS_COLOR[status]}`}>
                {BRIEF_STATUS_LABEL[status]}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs (detail mode) */}
        {!isNew && !editing && (
          <div className="flex border-b border-slate-100 px-6 overflow-x-auto">
            {(['info','guion','comentarios','archivos','asignados','historial'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); if (t === 'archivos') loadFiles() }}
                className={`py-2.5 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                  tab === t ? 'border-[#17394f] text-[#17394f]' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'info' ? 'Info'
                  : t === 'guion' ? 'Guión'
                  : t === 'comentarios' ? (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Comentarios
                      {commentCount > 0 && (
                        <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#17394f] text-white text-[9px] font-bold">{commentCount}</span>
                      )}
                    </span>
                  )
                  : t === 'archivos' ? `Archivos${files.length > 0 ? ` (${files.length})` : ''}`
                  : t === 'asignados' ? 'Asignados'
                  : 'Historial'}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* ── FORM (new or editing) ── */}
          {(isNew || editing) && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={LABEL}>Título *</label>
                  <input className={INPUT} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Reel tips de inversión — semana 3" />
                </div>
                {isNew && (
                  <div className="col-span-2">
                    <label className={LABEL}>Cliente *</label>
                    <select className={INPUT} value={clientId} onChange={e => setClientId(e.target.value)}>
                      <option value="">Selecciona un cliente</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className={LABEL}>Tipo *</label>
                  <select className={INPUT} value={type} onChange={e => setType(e.target.value as ContentType)}>
                    {CONTENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Estado</label>
                  <select className={INPUT} value={status} onChange={e => setStatus(e.target.value as BriefStatus)} disabled={isLocked}>
                    {ALL_BRIEF_STATUSES.map(s => <option key={s} value={s}>{BRIEF_STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={LABEL}>Plataformas *</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => togglePlatform(p.value)}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                        platforms.includes(p.value)
                          ? 'bg-[#17394f] text-white border-[#17394f]'
                          : 'border-slate-200 text-slate-600 hover:border-[#17394f]/40'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={LABEL}>Concepto</label>
                <textarea className={`${INPUT} resize-none`} rows={2} value={concept} onChange={e => setConcept(e.target.value)} placeholder="Idea central en 1-3 líneas" />
              </div>

              <div>
                <button className="flex items-center gap-1 text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide" onClick={() => setShowScript(s => !s)}>
                  Guión / estructura {showScript ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showScript && (
                  <textarea
                    className={`${INPUT} resize-none font-mono text-xs`}
                    rows={6}
                    value={script}
                    onChange={e => setScript(e.target.value)}
                    placeholder={SCRIPT_HINT[type]}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Copy / caption borrador</label>
                  <textarea className={`${INPUT} resize-none`} rows={3} value={copyDraft} onChange={e => setCopyDraft(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Hashtags</label>
                  <textarea className={`${INPUT} resize-none`} rows={3} value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#hax #contenido" />
                </div>
              </div>

              <div>
                <label className={LABEL}>Indicaciones técnicas</label>
                <textarea className={`${INPUT} resize-none`} rows={2} value={technicalNotes} onChange={e => setTechnicalNotes(e.target.value)} placeholder="Duración, formato, ratio, música sugerida…" />
              </div>

              <div>
                <label className={LABEL}>Referencias visuales</label>
                <div className="space-y-1 mb-2">
                  {referencesUrls.map((url, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate flex-1">{url}</a>
                      <button onClick={() => setReferencesUrls(prev => prev.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className={INPUT} value={newRef} onChange={e => setNewRef(e.target.value)} placeholder="https://..." onKeyDown={e => e.key === 'Enter' && addRef()} />
                  <button onClick={addRef} className="px-3 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200"><Plus className="w-4 h-4" /></button>
                </div>
              </div>

              {!isNew && (
                <div>
                  <label className={LABEL}>Notas de aprobación del cliente</label>
                  <textarea className={`${INPUT} resize-none`} rows={2} value={clientApprovalNotes} onChange={e => setClientApprovalNotes(e.target.value)} />
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <input type="checkbox" id="recurring" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded" />
                <label htmlFor="recurring" className="text-sm text-slate-600">Es formato recurrente</label>
                {isRecurring && (
                  <select className="border border-slate-200 rounded-lg px-2 py-1 text-sm" value={recurrenceFreq} onChange={e => setRecurrenceFreq(e.target.value)}>
                    <option value="">Frecuencia</option>
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                )}
              </div>
            </>
          )}

          {/* ── DETAIL TABS ── */}
          {!isNew && !editing && tab === 'info' && (
            <div className="space-y-4">
              {brief?.concept && (
                <div>
                  <p className={LABEL}>Concepto</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{brief.concept}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className={LABEL}>Tipo</p><p className="text-slate-700">{brief?.type}</p></div>
                <div><p className={LABEL}>Plataformas</p><p className="text-slate-700">{brief?.platforms.join(', ')}</p></div>
                {brief?.technicalNotes && <div className="col-span-2"><p className={LABEL}>Indicaciones técnicas</p><p className="text-slate-700">{brief.technicalNotes}</p></div>}
                {brief?.clientApprovalNotes && <div className="col-span-2"><p className={LABEL}>Notas aprobación cliente</p><p className="text-slate-700">{brief.clientApprovalNotes}</p></div>}
                {brief?.hashtags && <div className="col-span-2"><p className={LABEL}>Hashtags</p><p className="text-slate-700">{brief.hashtags}</p></div>}
              </div>
              {brief?.referencesUrls?.length > 0 && (
                <div>
                  <p className={LABEL}>Referencias</p>
                  <div className="space-y-1">
                    {brief.referencesUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-600 hover:underline truncate">{url}</a>
                    ))}
                  </div>
                </div>
              )}
              {/* Status change */}
              {isAdmin && !isLocked && (
                <div>
                  <p className={LABEL}>Cambiar estado</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_BRIEF_STATUSES.filter(s => s !== 'cancelado').map(s => (
                      <button
                        key={s}
                        onClick={() => changeStatus(s)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                          status === s ? BRIEF_STATUS_COLOR[s] + ' border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {BRIEF_STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isNew && !editing && tab === 'guion' && (
            <div>
              {brief?.script
                ? <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50 rounded-xl p-4">{brief.script}</pre>
                : <p className="text-slate-400 text-sm text-center py-8">Sin guión registrado</p>
              }
              {brief?.copyDraft && (
                <div className="mt-4">
                  <p className={LABEL}>Copy / caption borrador</p>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-4">{brief.copyDraft}</p>
                </div>
              )}
            </div>
          )}

          {!isNew && !editing && tab === 'archivos' && (
            <div className="space-y-3">
              {/* Preview modal */}
              {previewFile && (
                <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewFile(null)}>
                  <div className="max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-sm font-medium truncate">{previewFile.label || previewFile.originalName}</span>
                      <button onClick={() => setPreviewFile(null)} className="text-white/60 hover:text-white ml-4"><X className="w-5 h-5" /></button>
                    </div>
                    {previewFile.mimeType.startsWith('image/') && (
                      <img src={`${API_BASE}/briefs/${brief!.id}/files/${previewFile.id}/view`} alt={previewFile.originalName} className="max-h-[80vh] object-contain rounded-xl" />
                    )}
                    {previewFile.mimeType === 'application/pdf' && (
                      <iframe src={`${API_BASE}/briefs/${brief!.id}/files/${previewFile.id}/view`} className="w-full h-[80vh] rounded-xl bg-white" />
                    )}
                    {previewFile.mimeType.startsWith('video/') && (
                      <video src={`${API_BASE}/briefs/${brief!.id}/files/${previewFile.id}/view`} controls className="max-h-[80vh] rounded-xl w-full" />
                    )}
                  </div>
                </div>
              )}

              {/* Upload zone */}
              {isAdmin && (
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center hover:border-[#17394f]/40 transition cursor-pointer bg-slate-50/50"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) uploadFile(f) }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }}
                  />
                  {uploading
                    ? <p className="text-sm text-slate-500">Subiendo…</p>
                    : <>
                        <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                        <p className="text-sm text-slate-500">Arrastra un archivo aquí o <span className="text-[#17394f] font-medium">haz clic para seleccionar</span></p>
                        <p className="text-xs text-slate-400 mt-0.5">Imágenes, videos, PDFs, diseños…</p>
                      </>
                  }
                </div>
              )}

              {/* File list */}
              {!filesLoaded && <p className="text-sm text-slate-400 text-center py-4">Cargando archivos…</p>}
              {filesLoaded && files.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin archivos adjuntos</p>}
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 group">
                  <span className="text-slate-400 shrink-0">{fileIcon(f.mimeType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{f.label || f.originalName}</p>
                    {f.label && <p className="text-xs text-slate-400 truncate">{f.originalName}</p>}
                    <p className="text-xs text-slate-400">{fmtBytes(f.sizeBytes)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isPreviewable(f.mimeType) && (
                      <button onClick={() => setPreviewFile(f)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#17394f] hover:bg-white transition" title="Previsualizar">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <a
                      href={`${API_BASE}/briefs/${brief!.id}/files/${f.id}/download`}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#17394f] hover:bg-white transition"
                      title="Descargar"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    {isAdmin && (
                      <button onClick={() => deleteFile(f.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-400 hover:bg-white transition" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isNew && !editing && tab === 'asignados' && (
            <div className="space-y-3">
              {currentAssignees.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.user.name}</p>
                    <p className="text-xs text-slate-400">{BRIEF_ROLE_LABEL[a.role]}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => removeAssignee(a.userId, a.role)} className="text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {currentAssignees.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin asignados</p>}
              {isAdmin && !isLocked && (
                <div className="flex gap-2 pt-2">
                  <select className={`${INPUT} flex-1`} value={assigneeUserId} onChange={e => setAssigneeUserId(e.target.value)}>
                    <option value="">Selecciona usuario</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <select className={`${INPUT} w-32`} value={assigneeRole} onChange={e => setAssigneeRole(e.target.value as BriefRole)}>
                    {(Object.keys(BRIEF_ROLE_LABEL) as BriefRole[]).map(r => <option key={r} value={r}>{BRIEF_ROLE_LABEL[r]}</option>)}
                  </select>
                  <button onClick={addAssignee} disabled={!assigneeUserId || assigneeLoading} className="px-3 py-2 bg-[#17394f] text-white rounded-lg text-sm disabled:opacity-50">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {!isNew && !editing && tab === 'comentarios' && (
            <BriefComments
              briefId={brief!.id}
              currentUserId={currentUserId}
              isAdminOrLead={isAdmin}
              teamUsers={users.map(u => ({ id: u.id, name: u.name }))}
            />
          )}

          {!isNew && !editing && tab === 'historial' && (
            <div className="space-y-2">
              {(brief?.history ?? []).length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">Sin historial</p>
                : (brief?.history ?? []).map(h => (
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
          {!isNew && !editing && isAdmin && (
            <button onClick={() => setEditing(true)} className="text-sm text-slate-500 hover:text-slate-700">Editar</button>
          )}
          {!isNew && !editing && isAdmin && (
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: 'Eliminar brief',
                  message: `¿Eliminar "${brief?.title}"? Esta acción no se puede deshacer.`,
                  confirmLabel: 'Eliminar',
                  danger: true,
                })
                if (ok) {
                  await api.delete(`/api/briefs/${brief!.id}`)
                  onDelete(brief!.id)
                  onClose()
                }
              }}
              className="text-sm text-red-400 hover:text-red-600"
            >
              Eliminar
            </button>
          )}
          {!isNew && !editing && isAdmin && brief?.status !== 'cancelado' && (
            <button
              onClick={async () => {
                const ok = await confirm({ message: '¿Cancelar este brief?', confirmLabel: 'Cancelar brief' })
                if (ok) { await changeStatus('cancelado', true); onClose() }
              }}
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              Cancelar brief
            </button>
          )}
          {(isNew || editing) && (
            <div className="flex gap-2 ml-auto">
              <button onClick={() => isNew ? onClose() : setEditing(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || !clientId || !platforms.length}
                className="px-4 py-2 text-sm bg-[#17394f] text-white rounded-lg font-medium disabled:opacity-50 hover:bg-[#17394f]/90"
              >
                {saving ? 'Guardando…' : isNew ? 'Crear brief' : 'Guardar cambios'}
              </button>
            </div>
          )}
          {!isNew && !editing && (
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 ml-auto">
              Cerrar
            </button>
          )}
        </div>
      </div>

      {/* Status note modal */}
      {pendingStatus && brief && (
        <StatusNoteModal
          briefId={brief.id}
          newStatus={pendingStatus}
          teamUsers={users.map(u => ({ id: u.id, name: u.name }))}
          onConfirm={confirmStatusWithNote}
          onCancel={() => setPendingStatus(null)}
        />
      )}
    </div>
  )
}
