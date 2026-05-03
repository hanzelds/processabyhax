'use client'

import { useState } from 'react'
import { PortalData, PortalPiece, PortalBrief, PortalBriefFile } from './types'

const API_PATH = '/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  post: '📸', carrusel: '🎠', reel: '🎬', story: '📱', video: '📹',
}
const TYPE_LABEL: Record<string, string> = {
  post: 'Post', carrusel: 'Carrusel', reel: 'Reel', story: 'Story', video: 'Video',
}
const PLATFORM_SHORT: Record<string, string> = {
  instagram: 'IG', tiktok: 'TK', facebook: 'FB', linkedin: 'LI', youtube: 'YT',
}

function approvalOf(item: { portalApproval: { action: string } | null }): 'pending' | 'approved' | 'changes' {
  if (!item.portalApproval) return 'pending'
  return item.portalApproval.action === 'approved' ? 'approved' : 'changes'
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}
function isImg(m: string) { return m.startsWith('image/') }
function isVid(m: string) { return m.startsWith('video/') }
function isPdf(m: string) { return m === 'application/pdf' }

// ── File preview ──────────────────────────────────────────────────────────────

function FileAttachment({ briefId, file }: { briefId: string; file: PortalBriefFile }) {
  const [open, setOpen] = useState(false)
  const url = `${API_PATH}/briefs/${briefId}/files/${file.id}/view`
  const canPreview = isImg(file.mimeType) || isVid(file.mimeType) || isPdf(file.mimeType)

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4" onClick={() => setOpen(false)}>
          <button className="self-end mb-3 text-white/60 hover:text-white text-2xl leading-none" onClick={() => setOpen(false)}>✕</button>
          <div className="w-full max-w-2xl max-h-[80vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {isImg(file.mimeType) && <img src={url} alt={file.originalName} className="max-h-[80vh] max-w-full rounded-xl object-contain" />}
            {isPdf(file.mimeType) && <iframe src={url} className="w-full h-[80vh] rounded-xl bg-white" />}
            {isVid(file.mimeType) && <video src={url} controls autoPlay className="max-h-[80vh] w-full rounded-xl" />}
          </div>
          <p className="text-white/50 text-xs mt-3">{file.label || file.originalName}</p>
        </div>
      )}
      <button
        onClick={() => canPreview ? setOpen(true) : undefined}
        className={`flex items-center gap-2 w-full text-left bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 transition ${canPreview ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default'}`}
      >
        <span className="text-base shrink-0">{isImg(file.mimeType) ? '🖼️' : isVid(file.mimeType) ? '🎬' : isPdf(file.mimeType) ? '📄' : '📎'}</span>
        <span className="text-sm text-slate-700 flex-1 truncate">{file.label || file.originalName}</span>
        <span className="text-xs text-slate-400 shrink-0">{fmtBytes(file.sizeBytes)}</span>
        {canPreview && <span className="text-xs text-[#17394f] font-medium shrink-0">Ver</span>}
      </button>
    </>
  )
}

// ── Changes form (inline, minimal) ────────────────────────────────────────────

function ChangesForm({ onSubmit, onCancel, saving }: {
  onSubmit: (feedback: string) => void
  onCancel: () => void
  saving: boolean
}) {
  const [text, setText] = useState('')
  return (
    <div className="space-y-3 pt-3 border-t border-amber-100">
      <p className="text-sm font-semibold text-slate-800">¿Qué necesita cambio?</p>
      <textarea
        autoFocus
        rows={3}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Describe exactamente qué quieres cambiar…"
        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(text)}
          disabled={saving || !text.trim()}
          className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition"
        >
          {saving ? 'Enviando…' : 'Enviar comentario'}
        </button>
        <button onClick={onCancel} className="px-4 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl transition">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Review card (piece or brief) ──────────────────────────────────────────────

function ReviewCard({
  id, title, type, platforms, scheduledDate, scheduledTime,
  copy, hashtags, notes, refsUrls, script, concept, technicalNotes, files,
  briefId, approval, priorFeedback,
  onApprove, onChanges,
}: {
  id: string
  title: string
  type: string
  platforms: string[]
  scheduledDate?: string | null
  scheduledTime?: string | null
  copy?: string | null
  hashtags?: string | null
  notes?: string | null
  refsUrls?: string[]
  script?: string | null
  concept?: string | null
  technicalNotes?: string | null
  files?: PortalBriefFile[]
  briefId?: string
  approval: 'pending' | 'approved' | 'changes'
  priorFeedback?: string | null
  onApprove: () => void
  onChanges: (feedback: string) => void
}) {
  const [mode, setMode] = useState<'idle' | 'changes'>('idle')
  const [saving, setSaving] = useState(false)

  async function handleApprove() {
    setSaving(true)
    try { await onApprove() } finally { setSaving(false) }
  }
  async function handleChanges(feedback: string) {
    setSaving(true)
    try { await onChanges(feedback); setMode('idle') } finally { setSaving(false) }
  }

  const isPending = approval === 'pending'
  const isApproved = approval === 'approved'

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      isApproved ? 'border-emerald-200 bg-emerald-50/30' :
      approval === 'changes' ? 'border-amber-200 bg-amber-50/30' :
      'border-slate-200 bg-white shadow-sm'
    }`}>
      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5 shrink-0">{TYPE_ICON[type] ?? '📄'}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{TYPE_LABEL[type] ?? type}</span>
              {platforms.slice(0, 3).map(p => (
                <span key={p} className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{PLATFORM_SHORT[p] ?? p}</span>
              ))}
              {scheduledDate && (
                <span className="text-xs text-slate-400">{fmtDate(scheduledDate)}{scheduledTime ? ` · ${scheduledTime}` : ''}</span>
              )}
            </div>
            <p className="font-semibold text-slate-900 leading-snug">{title}</p>
          </div>
          {/* Status pill */}
          <div className="shrink-0">
            {isApproved && <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">✓ Aprobado</span>}
            {approval === 'changes' && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">Cambios solicitados</span>}
          </div>
        </div>
      </div>

      {/* Content body — always visible */}
      <div className="px-4 pb-4 space-y-3">
        {concept && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Concepto</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{concept}</p>
          </div>
        )}
        {script && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Guión</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl p-3">{script}</p>
          </div>
        )}
        {copy && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Caption</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{copy}</p>
          </div>
        )}
        {hashtags && (
          <p className="text-sm text-[#17394f] leading-relaxed">{hashtags}</p>
        )}
        {technicalNotes && (
          <div className="bg-slate-50 rounded-xl px-3 py-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notas técnicas</p>
            <p className="text-xs text-slate-600 leading-relaxed">{technicalNotes}</p>
          </div>
        )}
        {notes && (
          <div className="bg-slate-50 rounded-xl px-3 py-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nota del equipo</p>
            <p className="text-xs text-slate-600 italic leading-relaxed">{notes}</p>
          </div>
        )}
        {refsUrls && refsUrls.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Referencias</p>
            {refsUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="block text-sm text-[#17394f] underline truncate">{url}</a>
            ))}
          </div>
        )}
        {files && files.length > 0 && briefId && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">📎 Archivos ({files.length})</p>
            <div className="space-y-1.5">
              {files.map(f => <FileAttachment key={f.id} briefId={briefId} file={f} />)}
            </div>
          </div>
        )}

        {/* Prior changes feedback */}
        {approval === 'changes' && priorFeedback && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Tu comentario</p>
            <p className="text-sm text-amber-800">"{priorFeedback}"</p>
          </div>
        )}

        {/* Action zone */}
        {isApproved ? (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-emerald-500 text-lg">✅</span>
            <span className="text-sm font-semibold text-emerald-700">Aprobado — gracias</span>
          </div>
        ) : mode === 'changes' ? (
          <ChangesForm onSubmit={handleChanges} onCancel={() => setMode('idle')} saving={saving} />
        ) : (
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleApprove}
              disabled={saving}
              className="flex-1 bg-[#17394f] hover:bg-[#17394f]/90 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition active:scale-[.98]"
            >
              {saving ? '…' : '✅ Aprobar'}
            </button>
            <button
              onClick={() => setMode('changes')}
              disabled={saving}
              className="flex-1 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold rounded-xl py-3 text-sm transition active:scale-[.98]"
            >
              ✏️ Pedir cambios
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main portal ───────────────────────────────────────────────────────────────

type Tab = 'pendiente' | 'aprobado' | 'briefs'

export function PortalClient({ data: initialData, token }: { data: PortalData; token: string }) {
  const [data, setData] = useState(initialData)
  const [tab, setTab] = useState<Tab>('pendiente')
  const [approvingAll, setApprovingAll] = useState(false)

  const allPieces = data.pieces
  const pending  = allPieces.filter(p => approvalOf(p) === 'pending')
  const approved = allPieces.filter(p => approvalOf(p) !== 'pending')
  const briefsPending = data.briefs.filter(b => approvalOf(b) === 'pending')

  const totalPending = pending.length + briefsPending.length

  // ── Optimistic updates ────────────────────────────────────────────────────

  function updatePiece(id: string, action: 'approved' | 'changes_requested', feedback?: string) {
    setData(prev => ({
      ...prev,
      pieces: prev.pieces.map(p =>
        p.id === id ? { ...p, portalApproval: { action, changeType: null, feedback: feedback ?? null } } : p
      ),
    }))
  }

  function updateBrief(id: string, action: 'approved' | 'changes_requested', feedback?: string) {
    setData(prev => ({
      ...prev,
      briefs: prev.briefs.map(b =>
        b.id === id ? { ...b, portalApproval: { action, changeType: null, feedback: feedback ?? null } } : b
      ),
    }))
  }

  // ── Remote actions ────────────────────────────────────────────────────────

  async function approvePiece(id: string) {
    updatePiece(id, 'approved')
    await fetch(`${API_PATH}/portal/${token}/approve/${id}`, { method: 'POST' })
  }

  async function changesPiece(id: string, feedback: string) {
    updatePiece(id, 'changes_requested', feedback)
    await fetch(`${API_PATH}/portal/${token}/changes/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changeType: 'other', feedback }),
    })
  }

  async function approveBrief(id: string) {
    updateBrief(id, 'approved')
    await fetch(`${API_PATH}/portal/${token}/approve-brief/${id}`, { method: 'POST' })
  }

  async function changesBrief(id: string, feedback: string) {
    updateBrief(id, 'changes_requested', feedback)
    await fetch(`${API_PATH}/portal/${token}/changes-brief/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changeType: 'other', feedback }),
    })
  }

  async function approveAll() {
    setApprovingAll(true)
    try {
      setData(prev => ({
        ...prev,
        pieces: prev.pieces.map(p =>
          approvalOf(p) === 'pending' ? { ...p, portalApproval: { action: 'approved', changeType: null, feedback: null } } : p
        ),
      }))
      await fetch(`${API_PATH}/portal/${token}/approve-all`, { method: 'POST' })
    } finally { setApprovingAll(false) }
  }

  // ── Progress bar ──────────────────────────────────────────────────────────
  const total    = allPieces.length
  const nApproved = allPieces.filter(p => approvalOf(p) === 'approved').length
  const pct = total > 0 ? Math.round((nApproved / total) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <p className="text-xs text-slate-400 leading-none mb-0.5">Portal de contenido · Hax</p>
              <p className="font-bold text-slate-900">{data.client.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 leading-none mb-0.5 capitalize">{data.monthLabel}</p>
              {totalPending > 0
                ? <p className="text-sm font-bold text-amber-600">{totalPending} pendiente{totalPending !== 1 ? 's' : ''}</p>
                : <p className="text-sm font-bold text-emerald-600">✓ Todo revisado</p>
              }
            </div>
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-400 shrink-0">{nApproved}/{total}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-0">
          {([
            ['pendiente', `Pendiente${pending.length > 0 ? ` (${pending.length + briefsPending.length})` : ''}`],
            ['aprobado', `Aprobado${approved.length > 0 ? ` (${approved.length})` : ''}`],
            ...(data.briefs.length > 0 ? [['briefs', `Briefs${data.briefs.length > 0 ? ` (${data.briefs.length})` : ''}`]] : []),
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                tab === t
                  ? 'border-[#17394f] text-[#17394f]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── TAB: Pendiente ── */}
        {tab === 'pendiente' && (
          <>
            {/* Objectives mini-strip */}
            {data.objective && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                {[
                  { icon: '💬', label: 'Engagement', val: data.objective.engagementGoal },
                  { icon: '📡', label: 'Alcance',    val: data.objective.reachGoal },
                  { icon: '👥', label: 'Seguidores', val: data.objective.followersGoal },
                  { icon: '🎯', label: 'Leads',      val: data.objective.leadsGoal },
                ].filter(o => o.val).map(o => (
                  <div key={o.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
                    <p className="text-lg mb-0.5">{o.icon}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{o.label}</p>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5 leading-snug">{o.val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Pending pieces */}
            {pending.length === 0 && briefsPending.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">🎉</p>
                <p className="font-bold text-slate-700 text-lg">¡Todo revisado!</p>
                <p className="text-sm text-slate-400 mt-1">No hay piezas pendientes de aprobación.</p>
              </div>
            ) : (
              <>
                {pending.map(p => (
                  <ReviewCard
                    key={p.id}
                    id={p.id}
                    title={p.title}
                    type={p.type}
                    platforms={p.platforms}
                    scheduledDate={p.scheduledDate}
                    scheduledTime={p.scheduledTime}
                    copy={p.copy}
                    hashtags={p.hashtags}
                    notes={p.publicationNotes}
                    refsUrls={p.referencesUrls}
                    approval="pending"
                    onApprove={() => approvePiece(p.id)}
                    onChanges={fb => changesPiece(p.id, fb)}
                  />
                ))}
                {briefsPending.map(b => (
                  <ReviewCard
                    key={b.id}
                    id={b.id}
                    title={b.title}
                    type={b.type}
                    platforms={b.platforms}
                    concept={b.concept}
                    script={b.script}
                    copy={b.copyDraft}
                    hashtags={b.hashtags}
                    technicalNotes={b.technicalNotes}
                    files={b.files}
                    briefId={b.id}
                    approval="pending"
                    onApprove={() => approveBrief(b.id)}
                    onChanges={fb => changesBrief(b.id, fb)}
                  />
                ))}

                {/* Approve all */}
                {(pending.length + briefsPending.length) > 1 && (
                  <div className="pt-2">
                    <button
                      onClick={approveAll}
                      disabled={approvingAll}
                      className="w-full border-2 border-[#17394f] text-[#17394f] font-bold rounded-2xl py-4 text-sm hover:bg-[#17394f]/5 disabled:opacity-40 transition active:scale-[.99]"
                    >
                      {approvingAll ? 'Aprobando todo…' : `✅ Aprobar todo (${pending.length + briefsPending.length} piezas)`}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── TAB: Aprobado ── */}
        {tab === 'aprobado' && (
          <>
            {approved.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">⏳</p>
                <p className="font-bold text-slate-700">Aún no hay piezas aprobadas</p>
                <p className="text-sm text-slate-400 mt-1">Ve a la pestaña Pendiente para revisar.</p>
              </div>
            ) : (
              approved.map(p => (
                <ReviewCard
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  type={p.type}
                  platforms={p.platforms}
                  scheduledDate={p.scheduledDate}
                  scheduledTime={p.scheduledTime}
                  copy={p.copy}
                  hashtags={p.hashtags}
                  notes={p.publicationNotes}
                  refsUrls={p.referencesUrls}
                  approval={approvalOf(p)}
                  priorFeedback={p.portalApproval?.feedback}
                  onApprove={() => approvePiece(p.id)}
                  onChanges={fb => changesPiece(p.id, fb)}
                />
              ))
            )}
          </>
        )}

        {/* ── TAB: Briefs ── */}
        {tab === 'briefs' && (
          <>
            {data.briefs.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-400">No hay briefs para revisar este mes.</p>
              </div>
            ) : (
              data.briefs.map(b => (
                <ReviewCard
                  key={b.id}
                  id={b.id}
                  title={b.title}
                  type={b.type}
                  platforms={b.platforms}
                  concept={b.concept}
                  script={b.script}
                  copy={b.copyDraft}
                  hashtags={b.hashtags}
                  technicalNotes={b.technicalNotes}
                  files={b.files}
                  briefId={b.id}
                  approval={approvalOf(b)}
                  priorFeedback={b.portalApproval?.feedback}
                  onApprove={() => approveBrief(b.id)}
                  onChanges={fb => changesBrief(b.id, fb)}
                />
              ))
            )}
          </>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-300 pt-4 pb-8">
          Hax Estudio Creativo · Acceso válido hasta {new Date(data.expiresAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'long' })}
        </p>
      </main>
    </div>
  )
}
