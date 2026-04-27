'use client'

import { useState } from 'react'
import { ContentBrief, BriefStatus, BriefRole, Client, User, ContentType, ContentPlatform } from '@/types'
import {
  BRIEF_STATUS_LABEL, BRIEF_STATUS_COLOR, ALL_BRIEF_STATUSES,
  CONTENT_TYPE_OPTIONS, PLATFORM_OPTIONS, BRIEF_ROLE_LABEL, COPY_STATUS_LABEL,
} from '@/lib/utils'
import { api } from '@/lib/api'
import { X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

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
  onUpdate: (b: ContentBrief) => void
  onDelete: (id: string) => void
  onCreate?: (b: ContentBrief) => void
  onClose: () => void
}

export function BriefModal({ brief, defaultStatus, clients, users, isAdmin, onUpdate, onDelete, onCreate, onClose }: Props) {
  const isNew = !brief

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
  const [tab, setTab]           = useState<'info'|'guion'|'asignados'|'historial'>('info')
  const [showScript, setShowScript] = useState(false)

  const isLocked = brief?.status === 'entregado' || brief?.status === 'cancelado'

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

  async function changeStatus(s: BriefStatus) {
    if (!brief) return
    const updated = await api.patch<ContentBrief>(`/api/briefs/${brief.id}/status`, { status: s })
    setStatus(s)
    onUpdate(updated)
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
          <div className="flex border-b border-slate-100 px-6">
            {(['info','guion','asignados','historial'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-2.5 px-3 text-sm font-medium border-b-2 transition-colors capitalize -mb-px ${
                  tab === t ? 'border-[#17394f] text-[#17394f]' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'info' ? 'Info' : t === 'guion' ? 'Guión' : t === 'asignados' ? 'Asignados' : 'Historial'}
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
        <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-3">
          {!isNew && !editing && !isLocked && isAdmin && (
            <button onClick={() => setEditing(true)} className="text-sm text-slate-500 hover:text-slate-700">Editar</button>
          )}
          {!isNew && !editing && isAdmin && (
            <button
              onClick={async () => { if (confirm('¿Cancelar este brief?')) { await changeStatus('cancelado'); onClose() }}}
              className="text-sm text-red-400 hover:text-red-600 ml-auto mr-2"
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
    </div>
  )
}
