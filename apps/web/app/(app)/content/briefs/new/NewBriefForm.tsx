'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Client, User, BriefStatus, BriefRole, ContentType, ContentPlatform } from '@/types'
import {
  CONTENT_TYPE_OPTIONS, PLATFORM_OPTIONS, BRIEF_ROLE_LABEL, ALL_BRIEF_STATUSES, BRIEF_STATUS_LABEL,
} from '@/lib/utils'
import { api } from '@/lib/api'
import {
  ArrowLeft, Plus, X, FileText, Megaphone, AlignLeft, Hash,
  Settings, Link2, Users, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'

const INPUT  = 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/20 focus:border-[#17394f]/60 bg-white transition'
const LABEL  = 'text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wide'
const CARD   = 'bg-white border border-slate-200 rounded-2xl p-6'
const SECTION_ICON = 'w-4 h-4 text-[#17394f]'

const SCRIPT_HINT: Record<ContentType, string> = {
  reel:     'INTRO (0-3s): Hook que engancha\nDESARROLLO (3-45s): 3-5 puntos clave, uno por escena\nCIERRE (últimos 3s): CTA claro — suscríbete, comenta, guarda',
  carrusel: 'SLIDE 1: Portada — título impactante\nSLIDE 2: Problema o contexto\nSLIDE 3-N: Un punto por slide (tip, dato, paso)\nSLIDE FINAL: CTA + contacto / logo',
  post:     'Visual principal: descripción de imagen\nCopy de acompañamiento\nCTA: acción que buscamos',
  story:    'Story 1: Visual / apertura\nStory 2-3: Desarrollo\nStory final: Link, sticker de acción o CTA',
  video:    'INTRO: Hook (primeros 5s)\nDESARROLLO: Contenido principal (estructura por bloques)\nCIERRE: CTA y llamado a la acción',
}

interface Props {
  clients: Client[]
  users: User[]
  defaultStatus?: string
  defaultClientId?: string
  currentUserId: string
}

interface PendingAssignee {
  userId: string
  role: BriefRole
  userName: string
}

export function NewBriefForm({ clients, users, defaultStatus, defaultClientId, currentUserId }: Props) {
  const router = useRouter()

  // ── Core fields ──────────────────────────────────────────────────────────────
  const [title, setTitle]           = useState('')
  const [clientId, setClientId]     = useState(defaultClientId ?? '')
  const [type, setType]             = useState<ContentType>('reel')
  const [platforms, setPlatforms]   = useState<ContentPlatform[]>([])
  const [status, setStatus]         = useState<BriefStatus>(
    (defaultStatus as BriefStatus) ?? 'idea'
  )

  // ── Content fields ────────────────────────────────────────────────────────────
  const [concept, setConcept]           = useState('')
  const [script, setScript]             = useState('')
  const [copyDraft, setCopyDraft]       = useState('')
  const [hashtags, setHashtags]         = useState('')
  const [technicalNotes, setTechnicalNotes] = useState('')
  const [referencesUrls, setReferencesUrls] = useState<string[]>([])
  const [newRef, setNewRef]             = useState('')

  // ── Recurrence ────────────────────────────────────────────────────────────────
  const [isRecurring, setIsRecurring]   = useState(false)
  const [recurrenceFreq, setRecurrenceFreq] = useState('')

  // ── Assignees (pending — added after create) ──────────────────────────────────
  const [pendingAssignees, setPendingAssignees] = useState<PendingAssignee[]>([])
  const [addUserId, setAddUserId]       = useState('')
  const [addRole, setAddRole]           = useState<BriefRole>('guionista')

  // ── UI state ──────────────────────────────────────────────────────────────────
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [showScript, setShowScript]     = useState(true)

  function togglePlatform(p: ContentPlatform) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function addRef() {
    if (newRef.trim()) { setReferencesUrls(prev => [...prev, newRef.trim()]); setNewRef('') }
  }

  function addPendingAssignee() {
    if (!addUserId) return
    const user = users.find(u => u.id === addUserId)
    if (!user) return
    // Avoid duplicate user+role combos
    const exists = pendingAssignees.some(a => a.userId === addUserId && a.role === addRole)
    if (exists) return
    setPendingAssignees(prev => [...prev, { userId: addUserId, role: addRole, userName: user.name }])
    setAddUserId('')
  }

  function removePendingAssignee(userId: string, role: BriefRole) {
    setPendingAssignees(prev => prev.filter(a => !(a.userId === userId && a.role === role)))
  }

  async function handleSubmit() {
    if (!title.trim() || !clientId || !platforms.length) {
      setError('Completa los campos obligatorios: título, cliente y al menos una plataforma.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const brief = await api.post<{ id: string }>('/api/briefs', {
        title, clientId, type, platforms, concept, script,
        copyDraft, hashtags, technicalNotes,
        isRecurring, recurrenceFreq: recurrenceFreq || null,
        referencesUrls, status,
      })

      // Add all pending assignees
      await Promise.allSettled(
        pendingAssignees.map(a =>
          api.post(`/api/briefs/${brief.id}/assignees`, { userId: a.userId, role: a.role })
        )
      )

      router.push(clientId ? `/content/briefs?clientId=${clientId}` : '/content/briefs')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear el brief')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = title.trim().length > 0 && clientId !== '' && platforms.length > 0

  return (
    <div className="min-h-full bg-slate-50">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-semibold text-slate-900 text-sm leading-none">Nuevo brief</h1>
            <p className="text-xs text-slate-400 mt-0.5">Preproducción de contenido</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
            className="px-5 py-2 text-sm bg-[#17394f] text-white rounded-xl font-medium disabled:opacity-40 hover:bg-[#17394f]/90 transition flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Creando…' : 'Crear brief'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8 space-y-6">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── 1. Identificación ── */}
        <section className={CARD}>
          <div className="flex items-center gap-2 mb-5">
            <FileText className={SECTION_ICON} />
            <h2 className="font-semibold text-slate-800">Identificación</h2>
            <span className="text-xs text-red-400 font-medium ml-1">* requeridos</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className={LABEL}>Título *</label>
              <input
                className={INPUT}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ej: Reel — 5 tips de inversión semana 3"
                autoFocus
              />
            </div>

            <div>
              <label className={LABEL}>Cliente *</label>
              <select className={INPUT} value={clientId} onChange={e => setClientId(e.target.value)}>
                <option value="">Selecciona un cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className={LABEL}>Estado inicial</label>
              <select className={INPUT} value={status} onChange={e => setStatus(e.target.value as BriefStatus)}>
                {ALL_BRIEF_STATUSES.filter(s => s !== 'cancelado').map(s => (
                  <option key={s} value={s}>{BRIEF_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL}>Tipo de contenido *</label>
              <select className={INPUT} value={type} onChange={e => setType(e.target.value as ContentType)}>
                {CONTENT_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL}>Plataformas *</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PLATFORM_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePlatform(p.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      platforms.includes(p.value)
                        ? 'bg-[#17394f] text-white border-[#17394f] shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:border-[#17394f]/40 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Concepto ── */}
        <section className={CARD}>
          <div className="flex items-center gap-2 mb-5">
            <Megaphone className={SECTION_ICON} />
            <h2 className="font-semibold text-slate-800">Concepto</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className={LABEL}>Idea central</label>
              <textarea
                className={`${INPUT} resize-none`}
                rows={3}
                value={concept}
                onChange={e => setConcept(e.target.value)}
                placeholder="¿Cuál es la idea principal del contenido? ¿Qué emoción o acción buscamos generar?"
              />
            </div>
            <div>
              <label className={LABEL}>Objetivo del contenido</label>
              <div className="flex flex-wrap gap-2">
                {['Educar', 'Entretener', 'Vender', 'Posicionar marca', 'Generar leads', 'Viral / alcance'].map(obj => (
                  <button
                    key={obj}
                    type="button"
                    onClick={() => {
                      const keyword = obj.toLowerCase()
                      setConcept(prev =>
                        prev.includes(keyword)
                          ? prev.replace(`[${keyword}]`, '').trim()
                          : `${prev}${prev ? '\n' : ''}[${keyword}]`
                      )
                    }}
                    className="px-3 py-1 rounded-full text-xs font-medium border border-slate-200 text-slate-600 hover:border-[#17394f]/40 hover:bg-slate-50 transition"
                  >
                    {obj}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. Guión / Estructura ── */}
        <section className={CARD}>
          <button
            className="flex items-center gap-2 w-full text-left mb-1"
            onClick={() => setShowScript(s => !s)}
          >
            <AlignLeft className={SECTION_ICON} />
            <h2 className="font-semibold text-slate-800 flex-1">Guión / Estructura</h2>
            <span className="text-xs text-slate-400 font-medium">{type === 'reel' ? 'Reel' : type === 'carrusel' ? 'Carrusel' : type === 'story' ? 'Story' : type === 'video' ? 'Video' : 'Post'}</span>
            {showScript ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showScript && (
            <div className="mt-4 space-y-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Estructura sugerida — {type}</p>
                <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono leading-relaxed">{SCRIPT_HINT[type]}</pre>
              </div>
              <textarea
                className={`${INPUT} resize-none font-mono text-xs leading-relaxed`}
                rows={10}
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder={`Escribe o pega el guión aquí…\n\n${SCRIPT_HINT[type]}`}
              />
            </div>
          )}
        </section>

        {/* ── 4. Copy & Hashtags ── */}
        <section className={CARD}>
          <div className="flex items-center gap-2 mb-5">
            <Hash className={SECTION_ICON} />
            <h2 className="font-semibold text-slate-800">Copy &amp; Hashtags</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={LABEL}>Copy / caption borrador</label>
              <textarea
                className={`${INPUT} resize-none`}
                rows={5}
                value={copyDraft}
                onChange={e => setCopyDraft(e.target.value)}
                placeholder="Primer borrador del texto que acompañará la publicación…"
              />
            </div>
            <div>
              <label className={LABEL}>Hashtags</label>
              <textarea
                className={`${INPUT} resize-none`}
                rows={5}
                value={hashtags}
                onChange={e => setHashtags(e.target.value)}
                placeholder="#marca #contenido #rrss&#10;#instagram #trending"
              />
            </div>
          </div>
        </section>

        {/* ── 5. Indicaciones técnicas ── */}
        <section className={CARD}>
          <div className="flex items-center gap-2 mb-5">
            <Settings className={SECTION_ICON} />
            <h2 className="font-semibold text-slate-800">Indicaciones técnicas</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className={LABEL}>Notas para producción / edición</label>
              <textarea
                className={`${INPUT} resize-none`}
                rows={3}
                value={technicalNotes}
                onChange={e => setTechnicalNotes(e.target.value)}
                placeholder="Duración, formato (9:16 / 1:1 / 16:9), música sugerida, transiciones, efectos, tipografía, paleta de colores…"
              />
            </div>
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setIsRecurring(v => !v)}
                  className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer ${isRecurring ? 'bg-[#17394f]' : 'bg-slate-200'}`}
                  style={{ height: '22px' }}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isRecurring ? 'translate-x-4.5' : 'translate-x-0'}`}
                    style={{ transform: isRecurring ? 'translateX(18px)' : 'translateX(0)' }} />
                </div>
                <span className="text-sm text-slate-700 font-medium">Formato recurrente</span>
              </label>
              {isRecurring && (
                <select
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/20"
                  value={recurrenceFreq}
                  onChange={e => setRecurrenceFreq(e.target.value)}
                >
                  <option value="">Selecciona frecuencia</option>
                  <option value="semanal">Semanal</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select>
              )}
            </div>
          </div>
        </section>

        {/* ── 6. Referencias visuales ── */}
        <section className={CARD}>
          <div className="flex items-center gap-2 mb-5">
            <Link2 className={SECTION_ICON} />
            <h2 className="font-semibold text-slate-800">Referencias visuales</h2>
          </div>
          <div className="space-y-2 mb-3">
            {referencesUrls.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-3">Sin referencias agregadas</p>
            )}
            {referencesUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                <Link2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline truncate flex-1">{url}</a>
                <button onClick={() => setReferencesUrls(prev => prev.filter((_, j) => j !== i))}
                  className="text-slate-300 hover:text-red-400 transition shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={INPUT}
              value={newRef}
              onChange={e => setNewRef(e.target.value)}
              placeholder="https://instagram.com/p/... o https://www.youtube.com/..."
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRef() } }}
            />
            <button
              onClick={addRef}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-600 transition flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* ── 7. Equipo asignado ── */}
        <section className={CARD}>
          <div className="flex items-center gap-2 mb-5">
            <Users className={SECTION_ICON} />
            <h2 className="font-semibold text-slate-800">Equipo asignado</h2>
            <span className="text-xs text-slate-400 ml-1">— se asignarán al crear el brief</span>
          </div>

          {/* Pending list */}
          {pendingAssignees.length > 0 && (
            <div className="space-y-2 mb-4">
              {pendingAssignees.map((a, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                  <div>
                    <span className="text-sm font-medium text-slate-800">{a.userName}</span>
                    <span className="text-xs text-slate-400 ml-2">{BRIEF_ROLE_LABEL[a.role]}</span>
                  </div>
                  <button onClick={() => removePendingAssignee(a.userId, a.role)}
                    className="text-slate-300 hover:text-red-400 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add assignee row */}
          <div className="flex gap-2">
            <select
              className={`${INPUT} flex-1`}
              value={addUserId}
              onChange={e => setAddUserId(e.target.value)}
            >
              <option value="">Selecciona un miembro del equipo</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}{u.area ? ` — ${u.area}` : ''}</option>)}
            </select>
            <select
              className={`${INPUT} w-36`}
              value={addRole}
              onChange={e => setAddRole(e.target.value as BriefRole)}
            >
              {(Object.entries(BRIEF_ROLE_LABEL) as [BriefRole, string][]).map(([r, l]) => (
                <option key={r} value={r}>{l}</option>
              ))}
            </select>
            <button
              onClick={addPendingAssignee}
              disabled={!addUserId}
              className="px-4 py-2 bg-[#17394f] text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-[#17394f]/90 transition flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* ── Bottom CTA (repeat) ── */}
        <div className="flex items-center justify-end gap-3 pb-8">
          {error && <p className="text-sm text-red-500 flex-1">{error}</p>}
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
            className="px-6 py-2.5 text-sm bg-[#17394f] text-white rounded-xl font-semibold disabled:opacity-40 hover:bg-[#17394f]/90 transition flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Creando brief…' : 'Crear brief'}
          </button>
        </div>
      </div>
    </div>
  )
}
