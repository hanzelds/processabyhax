'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Client, ContentBrief, ContentType, ContentPlatform, CopyStatus, ContentPieceStatus } from '@/types'
import { CONTENT_TYPE_OPTIONS, PLATFORM_OPTIONS, COPY_STATUS_LABEL, PIECE_STATUS_LABEL } from '@/lib/utils'
import { api } from '@/lib/api'
import {
  ArrowLeft, Plus, X, FileText, AlignLeft, Hash,
  Settings, Link2, Calendar, Loader2, CheckCircle,
} from 'lucide-react'

const INPUT  = 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/20 focus:border-[#17394f]/60 bg-white transition'
const LABEL  = 'text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wide'
const CARD   = 'bg-white border border-slate-200 rounded-2xl p-6'
const SECTION_ICON = 'w-4 h-4 text-[#17394f]'

const ALL_COPY_STATUSES: CopyStatus[] = ['pendiente', 'en_revision', 'aprobado']
const ALL_PIECE_STATUSES: ContentPieceStatus[] = ['listo', 'en_revision', 'en_edicion', 'programado', 'pausado']

const SCRIPT_HINT: Record<ContentType, string> = {
  reel:     'INTRO (0-3s): Hook que engancha\nDESARROLLO (3-45s): 3-5 puntos clave, uno por escena\nCIERRE (últimos 3s): CTA claro — suscríbete, comenta, guarda',
  carrusel: 'SLIDE 1: Portada — título impactante\nSLIDE 2: Problema o contexto\nSLIDE 3-N: Un punto por slide (tip, dato, paso)\nSLIDE FINAL: CTA + contacto / logo',
  post:     'Visual principal: descripción de imagen\nCopy de acompañamiento\nCTA: acción que buscamos',
  story:    'Story 1: Visual / apertura\nStory 2-3: Desarrollo\nStory final: Link, sticker de acción o CTA',
  video:    'INTRO: Hook (primeros 5s)\nDESARROLLO: Contenido principal (estructura por bloques)\nCIERRE: CTA y llamado a la acción',
}

interface Props {
  client: Client
  briefs: ContentBrief[]
  defaultDate: string
}

export function NewPieceForm({ client, briefs, defaultDate }: Props) {
  const router = useRouter()

  // ── Core fields ───────────────────────────────────────────────────────────────
  const [title, setTitle]             = useState('')
  const [type, setType]               = useState<ContentType>('reel')
  const [platforms, setPlatforms]     = useState<ContentPlatform[]>([])
  const [status, setStatus]           = useState<ContentPieceStatus>('listo')
  const [briefId, setBriefId]         = useState('')

  // ── Copy ──────────────────────────────────────────────────────────────────────
  const [copy, setCopy]               = useState('')
  const [hashtags, setHashtags]       = useState('')
  const [copyStatus, setCopyStatus]   = useState<CopyStatus>('pendiente')

  // ── Script ────────────────────────────────────────────────────────────────────
  const [script, setScript]           = useState('')
  const [showScript, setShowScript]   = useState(false)

  // ── Technical ─────────────────────────────────────────────────────────────────
  const [publicationNotes, setPublicationNotes] = useState('')

  // ── References ────────────────────────────────────────────────────────────────
  const [referencesUrls, setReferencesUrls] = useState<string[]>([])
  const [newRef, setNewRef]           = useState('')

  // ── Scheduling ───────────────────────────────────────────────────────────────
  const [scheduledDate, setScheduledDate] = useState(defaultDate)
  const [scheduledTime, setScheduledTime] = useState('')

  // ── UI ────────────────────────────────────────────────────────────────────────
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  function togglePlatform(p: ContentPlatform) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function addRef() {
    if (newRef.trim()) { setReferencesUrls(prev => [...prev, newRef.trim()]); setNewRef('') }
  }

  async function handleSubmit() {
    if (!title.trim() || !platforms.length) {
      setError('Completa los campos obligatorios: título y al menos una plataforma.')
      return
    }
    if (scheduledDate && status === 'listo') {
      // Auto-upgrade to scheduled when a date is set
    }
    setError('')
    setSaving(true)
    try {
      await api.post('/api/content/pieces', {
        title,
        clientId: client.id,
        type,
        platforms,
        copy: copy || null,
        hashtags: hashtags || null,
        referencesUrls,
        copyStatus,
        publicationNotes: publicationNotes || null,
        briefId: briefId || null,
        scheduledDate: scheduledDate || null,
        scheduledTime: scheduledTime || null,
        status: scheduledDate ? 'programado' : status,
      })
      router.push(`/content/calendar?clientId=${client.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear la pieza')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = title.trim().length > 0 && platforms.length > 0

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
            <h1 className="font-semibold text-slate-900 text-sm leading-none">Nueva pieza de contenido</h1>
            <p className="text-xs text-slate-400 mt-0.5">{client.name}</p>
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
            {saving ? 'Creando…' : 'Crear pieza'}
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
                placeholder="Ej: Reel — 5 tips para ahorrar en el supermercado"
                autoFocus
              />
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
              <label className={LABEL}>Estado inicial</label>
              <select className={INPUT} value={status} onChange={e => setStatus(e.target.value as ContentPieceStatus)}>
                {ALL_PIECE_STATUSES.map(s => (
                  <option key={s} value={s}>{PIECE_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
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

            {briefs.length > 0 && (
              <div className="md:col-span-2">
                <label className={LABEL}>Brief de origen (opcional)</label>
                <select className={INPUT} value={briefId} onChange={e => setBriefId(e.target.value)}>
                  <option value="">Sin brief asociado</option>
                  {briefs.map(b => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {/* ── 2. Publicación ── */}
        <section className={CARD}>
          <div className="flex items-center gap-2 mb-5">
            <Calendar className={SECTION_ICON} />
            <h2 className="font-semibold text-slate-800">Publicación</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={LABEL}>Fecha de publicación</label>
              <input
                type="date"
                className={INPUT}
                value={scheduledDate}
                onChange={e => setScheduledDate(e.target.value)}
              />
              {scheduledDate && (
                <p className="text-[11px] text-purple-600 font-medium mt-1.5 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Se programará automáticamente
                </p>
              )}
            </div>
            <div>
              <label className={LABEL}>Hora</label>
              <input
                type="time"
                className={INPUT}
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className={LABEL}>Notas de publicación</label>
              <textarea
                className={`${INPUT} resize-none`}
                rows={3}
                value={publicationNotes}
                onChange={e => setPublicationNotes(e.target.value)}
                placeholder="Instrucciones específicas para quien publica — hashtags prioritarios, hora exacta, menciones, stickers, etc."
              />
            </div>
          </div>
        </section>

        {/* ── 3. Copy & Hashtags ── */}
        <section className={CARD}>
          <div className="flex items-center gap-2 mb-5">
            <Hash className={SECTION_ICON} />
            <h2 className="font-semibold text-slate-800">Copy &amp; Hashtags</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={LABEL} style={{ marginBottom: 0 }}>Caption / copy</label>
                <select
                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                  value={copyStatus}
                  onChange={e => setCopyStatus(e.target.value as CopyStatus)}
                >
                  {ALL_COPY_STATUSES.map(s => <option key={s} value={s}>{COPY_STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <textarea
                className={`${INPUT} resize-none`}
                rows={6}
                value={copy}
                onChange={e => setCopy(e.target.value)}
                placeholder="Escribe o pega el copy final de la publicación…"
              />
            </div>
            <div>
              <label className={LABEL}>Hashtags</label>
              <textarea
                className={`${INPUT} resize-none`}
                rows={6}
                value={hashtags}
                onChange={e => setHashtags(e.target.value)}
                placeholder="#marca #contenido #rrss&#10;#instagram #trending"
              />
            </div>
          </div>
        </section>

        {/* ── 4. Guión / Estructura (colapsable) ── */}
        <section className={CARD}>
          <button
            className="flex items-center gap-2 w-full text-left"
            onClick={() => setShowScript(s => !s)}
          >
            <AlignLeft className={SECTION_ICON} />
            <h2 className="font-semibold text-slate-800 flex-1">Guión / Estructura</h2>
            <span className="text-xs text-slate-400">
              {showScript ? 'Ocultar' : 'Expandir'}
            </span>
          </button>
          {showScript && (
            <div className="mt-4 space-y-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Estructura sugerida — {type}
                </p>
                <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono leading-relaxed">
                  {SCRIPT_HINT[type]}
                </pre>
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

        {/* ── 5. Indicaciones técnicas ── */}
        <section className={CARD}>
          <div className="flex items-center gap-2 mb-5">
            <Settings className={SECTION_ICON} />
            <h2 className="font-semibold text-slate-800">Indicaciones técnicas</h2>
          </div>
          <div>
            <label className={LABEL}>Notas para edición / producción</label>
            <textarea
              className={`${INPUT} resize-none`}
              rows={3}
              value={publicationNotes}
              onChange={e => setPublicationNotes(e.target.value)}
              placeholder="Formato (9:16 / 1:1 / 16:9), duración, música sugerida, transiciones, efectos, paleta de colores…"
            />
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

        {/* ── Bottom CTA ── */}
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
            {saving ? 'Creando pieza…' : 'Crear pieza'}
          </button>
        </div>
      </div>
    </div>
  )
}
