'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { DocBlock, DocBlockType, DocPage, DocPageStatus, DocPageVersion, User } from '@/types'
import { makeBlock, placeCursorAtEnd, placeCursorAtStart } from './docUtils'
import { DocBlockRenderer } from './DocBlock'
import { BlockMenu } from './BlockMenu'
import { InlineToolbar } from './InlineToolbar'
import { VersionHistoryPanel } from './VersionHistoryPanel'
import { api } from '@/lib/api'
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { Star, Clock, ChevronDown, Check, Printer, MoreHorizontal, LayoutTemplate, X, Maximize2, Minimize2, Image as ImageIcon, Smile, MessageCircle, Share2, Link2, Copy, Download } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { DocTOC } from './DocTOC'
import { CommentsPanel } from './CommentsPanel'
import { ShareModal } from './ShareModal'

// ── Debounce ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms) }
}

// ── Relative time ─────────────────────────────────────────────────────────────

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime()
  if (diff < 60000)  return 'Guardado hace un momento'
  if (diff < 3600000) return `Guardado hace ${Math.floor(diff / 60000)} min`
  return `Guardado hace ${Math.floor(diff / 3600000)} h`
}

// ── Page Status ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DocPageStatus, { label: string; color: string; bg: string }> = {
  borrador:    { label: 'Borrador',    color: 'text-slate-600', bg: 'bg-slate-100' },
  en_revision: { label: 'En revisión', color: 'text-amber-700', bg: 'bg-amber-100' },
  aprobado:    { label: 'Aprobado',    color: 'text-emerald-700', bg: 'bg-emerald-100' },
  archivado:   { label: 'Archivado',   color: 'text-slate-400', bg: 'bg-slate-50 border border-slate-200' },
}

const STATUS_ORDER: DocPageStatus[] = ['borrador', 'en_revision', 'aprobado', 'archivado']

function PageStatusBadge({
  status,
  onChange,
  disabled,
}: {
  status: DocPageStatus
  onChange: (s: DocPageStatus) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CONFIG[status]

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} transition-opacity ${disabled ? 'cursor-default' : 'hover:opacity-80'}`}
      >
        {cfg.label}
        {!disabled && <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-slate-200 py-1 min-w-[140px]">
            {STATUS_ORDER.map(s => {
              const c = STATUS_CONFIG[s]
              return (
                <button
                  key={s}
                  onClick={() => { onChange(s); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 text-left"
                >
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.color}`}>{c.label}</span>
                  {s === status && <Check className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Emoji picker ──────────────────────────────────────────────────────────────

const EMOJI_GROUPS = [
  { label: 'Documentos', emojis: ['📄','📃','📋','📊','📈','📉','📌','📍','🗂','📁','📂','🗃','🗄','📎','📏','📐'] },
  { label: 'Ideas & Trabajo', emojis: ['💡','🔥','⚡','✅','🎯','🚀','🛠','🔧','⚙️','🧩','🧠','💼','📦','🔑','🏆','⭐'] },
  { label: 'Comunicación', emojis: ['💬','📢','📣','📝','✏️','🖊','🖋','📮','✉️','📧','🔔','📡','🗣','💌','📰','🗞'] },
  { label: 'Naturaleza & Símbolos', emojis: ['🌱','🌿','🍀','🌸','🌊','🌈','☀️','🌙','⭐','🔵','🟢','🟡','🔴','🟣','⚪','⬛'] },
]

function EmojiPickerPanel({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [filter, setFilter] = useState('')
  const allEmojis = EMOJI_GROUPS.flatMap(g => g.emojis)
  const filtered = filter ? allEmojis.filter(e => e.includes(filter)) : null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl border border-slate-200 shadow-xl w-72 p-3">
        <input
          autoFocus
          placeholder="Buscar emoji..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 mb-2 outline-none focus:border-[#17394f]/40"
        />
        {filtered ? (
          <div className="flex flex-wrap gap-0.5">
            {filtered.length === 0 && <p className="text-xs text-slate-400 py-2 w-full text-center">Sin resultados</p>}
            {filtered.map((e, i) => (
              <button key={i} onClick={() => { onSelect(e); onClose() }}
                className="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-slate-100 transition-colors">
                {e}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {EMOJI_GROUPS.map(g => (
              <div key={g.label}>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{g.label}</p>
                <div className="flex flex-wrap gap-0.5">
                  {g.emojis.map((e, i) => (
                    <button key={i} onClick={() => { onSelect(e); onClose() }}
                      className="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-slate-100 transition-colors">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => { onSelect(''); onClose() }}
          className="mt-2 w-full text-xs text-slate-400 hover:text-slate-600 py-1 hover:bg-slate-50 rounded-lg transition-colors">
          Quitar ícono
        </button>
      </div>
    </>
  )
}

// ── BlockMenu state ───────────────────────────────────────────────────────────

interface BlockMenuState {
  blockId: string
  filter: string
  position: { top: number; left: number }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  page: DocPage
  users?: User[]
  readOnly?: boolean
  onTitleChange?: (title: string) => void
  onPageCreated?: (newPageId: string, title: string) => void
  isAdmin?: boolean
  currentUserId?: string
}

export function DocEditor({ page, users = [], readOnly = false, onTitleChange, onPageCreated, isAdmin = false, currentUserId = '' }: Props) {
  const [blocks, setBlocks] = useState<DocBlock[]>(
    (page.content ?? []).length > 0 ? page.content : [makeBlock('paragraph')]
  )
  const [focusedId, setFocusedId]     = useState<string | null>(null)
  const [blockMenu, setBlockMenu]     = useState<BlockMenuState | null>(null)
  const [lastSaved, setLastSaved]     = useState<Date | null>(null)
  const [saving, setSaving]           = useState(false)
  const [title, setTitle]             = useState(page.title)

  // v2 state
  const [pageStatus, setPageStatus]   = useState<DocPageStatus>(page.pageStatus ?? 'borrador')
  const [isFavorite, setIsFavorite]   = useState(page.isFavorite ?? false)
  const [isTemplate, setIsTemplate]   = useState(page.isTemplate ?? false)
  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions]         = useState<DocPageVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [showOptions, setShowOptions]   = useState(false)
  const [icon, setIcon]                 = useState<string | null>(page.icon ?? null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [cover, setCover]               = useState<string | null>(page.cover ?? null)
  const [showCoverInput, setShowCoverInput] = useState(false)
  const [coverInputValue, setCoverInputValue] = useState(page.cover ?? '')
  const [fullWidth, setFullWidth]       = useState(page.fullWidth ?? false)
  const [titleHovered, setTitleHovered] = useState(false)
  // Phase 2 — comments, share, backlinks
  const [showComments, setShowComments] = useState(false)
  const [showShare, setShowShare]       = useState(false)
  const [backlinks, setBacklinks]       = useState<{ id: string; title: string; icon: string | null }[]>([])

  const blockRefs  = useRef<Map<string, HTMLElement>>(new Map())
  const titleRef   = useRef<HTMLDivElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setBlocks(prev => {
      const oldIdx = prev.findIndex(b => b.id === active.id)
      const newIdx = prev.findIndex(b => b.id === over.id)
      const next = arrayMove(prev, oldIdx, newIdx)
      saveBlocks(next)
      return next
    })
  }

  // Set title content once on mount — avoids cursor-jump bug with dangerouslySetInnerHTML
  useEffect(() => {
    if (titleRef.current) titleRef.current.innerText = page.title
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const toast = useToast()

  const [saveError, setSaveError] = useState(false)

  const saveNow = useCallback(async (current: DocBlock[]) => {
    setSaving(true)
    setSaveError(false)
    try {
      await api.put(`/api/docs/pages/${page.id}`, { content: current })
      setLastSaved(new Date())
    } catch (e) {
      console.error('Autosave failed', e)
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }, [page.id])

  // Autosave — debounce 1500ms
  const saveBlocks = useMemo(() => debounce(saveNow, 1500), [saveNow])

  const saveTitle = useMemo(() => debounce(async (t: string) => {
    try {
      await api.patch(`/api/docs/pages/${page.id}/meta`, { title: t || 'Sin título' })
      onTitleChange?.(t || 'Sin título')
    } catch {}
  }, 800), [page.id, onTitleChange])

  // Focus new block helper
  function focusBlock(id: string, atEnd = true) {
    setTimeout(() => {
      const el = blockRefs.current.get(id)
      if (el) { atEnd ? placeCursorAtEnd(el) : placeCursorAtStart(el) }
    }, 30)
  }

  // ── Block operations ──────────────────────────────────────────────────────

  const updateBlocks = useCallback((next: DocBlock[]) => {
    setBlocks(next)
    saveBlocks(next)
  }, [saveBlocks])
  void updateBlocks // suppress unused warning — kept for completeness

  const addBlockAfter = useCallback((afterId: string, type: DocBlockType = 'paragraph') => {
    const newBlock = makeBlock(type)
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === afterId)
      const next = [...prev]
      next.splice(idx + 1, 0, newBlock)
      saveBlocks(next)
      return next
    })
    setFocusedId(newBlock.id)
    focusBlock(newBlock.id)
    return newBlock.id
  }, [saveBlocks])

  const updateBlockContent = useCallback((id: string, content: Partial<DocBlock['content']>) => {
    setBlocks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, content: { ...b.content, ...content } } : b)
      saveBlocks(next)
      return next
    })
  }, [saveBlocks])

  const updateBlockHtml = useCallback((id: string, html: string) => {
    setBlocks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, content: { ...b.content, html } } : b)
      saveBlocks(next)
      return next
    })
  }, [saveBlocks])

  const deleteBlock = useCallback((id: string) => {
    setBlocks(prev => {
      if (prev.length <= 1) {
        const empty = [makeBlock('paragraph')]
        saveBlocks(empty)
        return empty
      }
      const idx  = prev.findIndex(b => b.id === id)
      const next = prev.filter(b => b.id !== id)
      saveBlocks(next)
      const targetId = next[Math.max(0, idx - 1)]?.id
      if (targetId) { setFocusedId(targetId); focusBlock(targetId) }
      return next
    })
  }, [saveBlocks])

  const moveBlock = useCallback((id: string, dir: 1 | -1) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      saveBlocks(next)
      return next
    })
  }, [saveBlocks])

  const duplicateBlock = useCallback((id: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      const copy = { ...prev[idx], id: Math.random().toString(36).slice(2, 10), content: { ...prev[idx].content } }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      saveBlocks(next)
      return next
    })
  }, [saveBlocks])

  const convertBlock = useCallback((id: string, type: DocBlockType) => {
    setBlocks(prev => {
      const next = prev.map(b => {
        if (b.id !== id) return b
        const newContent: DocBlock['content'] = {}
        if (['paragraph','heading_1','heading_2','heading_3'].includes(type)) {
          newContent.html = b.content.html ?? ''
        } else if (type === 'bulleted_list' || type === 'numbered_list') {
          const text = (b.content.html ?? '').replace(/<[^>]*>/g, '').trim()
          newContent.items = text ? [text] : ['']
        } else if (type === 'callout') {
          newContent.icon = '💡'
          newContent.html = b.content.html ?? ''
        }
        return { ...b, type, content: newContent }
      })
      saveBlocks(next)
      return next
    })
  }, [saveBlocks])

  // Navigate between blocks
  function focusPrev(id: string) {
    const idx = blocks.findIndex(b => b.id === id)
    if (idx > 0) { const prev = blocks[idx - 1]; setFocusedId(prev.id); focusBlock(prev.id) }
  }
  function focusNext(id: string) {
    const idx = blocks.findIndex(b => b.id === id)
    if (idx < blocks.length - 1) { const next = blocks[idx + 1]; setFocusedId(next.id); focusBlock(next.id) }
  }

  // Block menu: select block type
  function handleBlockMenuSelect(type: DocBlockType) {
    if (!blockMenu) return
    const id = blockMenu.blockId

    setBlocks(prev => {
      const next = prev.map(b => {
        if (b.id !== id) return b
        const newContent: DocBlock['content'] = {}
        if (['paragraph','heading_1','heading_2','heading_3'].includes(type)) newContent.html = ''
        else if (type === 'bulleted_list' || type === 'numbered_list') newContent.items = ['']
        else if (type === 'callout') { newContent.icon = '💡'; newContent.html = '' }
        else if (type === 'code') { newContent.language = 'javascript'; newContent.text = '' }
        else if (type === 'image') { newContent.url = ''; newContent.caption = '' }
        else if (type === 'child_page') { newContent.pageId = ''; newContent.title = 'Sin título'; newContent.pageIcon = '📄' }
        return { ...b, type, content: newContent }
      })
      saveBlocks(next)
      return next
    })

    setBlockMenu(null)
    setTimeout(() => {
      const el = blockRefs.current.get(id)
      if (el) {
        if ((el as HTMLDivElement).contentEditable === 'true') {
          ;(el as HTMLDivElement).innerHTML = ''
        }
        placeCursorAtEnd(el)
      }
    }, 30)
  }

  // ── Icon / cover / width ──────────────────────────────────────────────────

  async function handleIconSelect(emoji: string) {
    setIcon(emoji || null)
    try { await api.patch(`/api/docs/pages/${page.id}/meta`, { icon: emoji || null }) } catch {}
  }

  async function handleCoverSave(url: string) {
    const val = url.trim() || null
    setCover(val)
    setShowCoverInput(false)
    try { await api.patch(`/api/docs/pages/${page.id}/meta`, { cover: val }) } catch {}
  }

  async function handleToggleWidth() {
    const next = !fullWidth
    setFullWidth(next)
    try { await api.patch(`/api/docs/pages/${page.id}/meta`, { fullWidth: next }) } catch {}
  }

  // ── v2 actions ────────────────────────────────────────────────────────────

  async function handleStatusChange(s: DocPageStatus) {
    try {
      await api.patch(`/api/docs/pages/${page.id}/status`, { pageStatus: s })
      setPageStatus(s)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al cambiar estado')
    }
  }

  async function handleToggleFavorite() {
    try {
      if (isFavorite) {
        await api.delete(`/api/docs/favorites/${page.id}`)
      } else {
        await api.post(`/api/docs/favorites/${page.id}`, {})
      }
      setIsFavorite(f => !f)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar favoritos')
    }
  }

  async function handleDuplicate() {
    setShowOptions(false)
    try {
      const res = await api.post<{ pageId: string; title: string }>(`/api/docs/pages/${page.id}/duplicate`, {})
      toast.success('Página duplicada')
      window.location.href = `/docs/${res.pageId}`
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al duplicar')
    }
  }

  function handleExportMarkdown() {
    setShowOptions(false)
    window.open(`/api/docs/pages/${page.id}/export?format=md`, '_blank')
  }

  function handleExportPdf() {
    setShowOptions(false)
    const a = document.createElement('a')
    a.href = `/api/docs/pages/${page.id}/export?format=pdf`
    a.download = `${page.title || 'documento'}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Load backlinks once
  useEffect(() => {
    api.get<{ id: string; title: string; icon: string | null }[]>(`/api/docs/pages/${page.id}/backlinks`)
      .then(setBacklinks)
      .catch(() => {})
  }, [page.id])

  async function handleShowVersions() {
    setShowVersions(true)
    setVersionsLoading(true)
    try {
      const v = await api.get<DocPageVersion[]>(`/api/docs/pages/${page.id}/versions`)
      setVersions(v)
    } catch {
      toast.error('Error al cargar versiones')
    } finally {
      setVersionsLoading(false)
    }
  }

  async function handleRestoreVersion(versionId: string) {
    try {
      await api.post(`/api/docs/pages/${page.id}/versions/restore`, { versionId })
      // Reload the page to reflect restored content
      window.location.reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al restaurar versión')
    }
  }

  async function handleToggleTemplate() {
    try {
      const next = !isTemplate
      await api.patch(`/api/docs/pages/${page.id}/template`, {
        isTemplate: next,
        templateName: next ? (page.templateName || title) : null,
        templateDesc: next ? page.templateDesc : null,
      })
      setIsTemplate(next)
      setShowOptions(false)
      toast.success(next ? 'Página marcada como template' : 'Template eliminado')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar template')
    }
  }

  function handlePrint() {
    window.print()
  }

  // Cmd+S force save
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (!readOnly) saveNow(blocks)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [blocks, readOnly])

  // Relative time ticker
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  const STATUS_PRINT_LABEL: Record<string, string> = {
    borrador: 'Borrador', en_revision: 'En revisión', aprobado: 'Aprobado', archivado: 'Archivado',
  }

  const printDate = new Date(page.updatedAt).toLocaleDateString('es-DO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="flex-1 flex flex-col min-h-0">

      {/* Print CSS */}
      <style>{`
        @media print {
          /* Ocultar todo via visibility para no colapsar el DOM */
          * { visibility: hidden !important; }

          /* Mostrar solo el doc print root y sus hijos */
          #doc-print-root,
          #doc-print-root * { visibility: visible !important; }

          /* Posicionar en la esquina superior izquierda */
          #doc-print-root {
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            z-index: 99999 !important;
            background: white !important;
          }

          @page {
            size: A4 portrait;
            margin: 20mm 22mm 22mm 22mm;
          }

          /* Tipografía limpia */
          #doc-print-root p    { font-size: 11pt; line-height: 1.7; margin: 0 0 8pt; }
          #doc-print-root h1   { font-size: 22pt; margin: 0 0 12pt; page-break-after: avoid; }
          #doc-print-root h2   { font-size: 16pt; margin: 18pt 0 8pt; page-break-after: avoid; }
          #doc-print-root h3   { font-size: 13pt; margin: 14pt 0 6pt; page-break-after: avoid; }
          #doc-print-root ul, #doc-print-root ol { margin: 0 0 8pt; padding-left: 20pt; }
          #doc-print-root li   { font-size: 11pt; line-height: 1.6; margin-bottom: 3pt; }
          #doc-print-root pre, #doc-print-root code { page-break-inside: avoid; font-size: 9pt; }
          #doc-print-root blockquote { page-break-inside: avoid; border-left: 3px solid #17394f; padding-left: 10pt; margin: 8pt 0; color: #475569; }
          #doc-print-root img  { max-width: 100%; page-break-inside: avoid; }

          /* Header y title block */
          #doc-print-header      { display: flex !important; }
          #doc-print-title-block { display: block !important; }
        }
      `}</style>

      {/* Documento imprimible — invisible en pantalla, visible en @media print */}
      <div id="doc-print-root" style={{ display: 'none' }}>
        {/* Header con logo */}
        <div id="doc-print-header" style={{
          display: 'none',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '10px',
          marginBottom: '20px',
          borderBottom: '2px solid #17394f',
        }}>
          <img src="/hax-logo.svg" alt="HAX" style={{ height: '30px' }} />
          <div style={{ textAlign: 'right', fontSize: '9pt', color: '#64748b' }}>
            <div>{printDate}</div>
            {page.pageStatus && (
              <div style={{ fontWeight: 600, color: '#17394f', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '8pt' }}>
                {STATUS_PRINT_LABEL[page.pageStatus] ?? page.pageStatus}
              </div>
            )}
          </div>
        </div>

        {/* Título del documento */}
        <div id="doc-print-title-block" style={{ display: 'none', marginBottom: '24pt', borderBottom: '1px solid #e2e8f0', paddingBottom: '14pt' }}>
          {icon && <div style={{ fontSize: '36pt', marginBottom: '8pt' }}>{icon}</div>}
          <h1 style={{ fontSize: '26pt', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.15 }}>
            {title || page.title}
          </h1>
          <div style={{ fontSize: '9pt', color: '#94a3b8', marginTop: '6pt' }}>
            Autor: {page.createdBy.name}
            {page.updatedBy && page.updatedBy.id !== page.createdBy.id && ` · Editado por: ${page.updatedBy.name}`}
          </div>
        </div>

        {/* Contenido — clone del área de bloques renderizado para impresión */}
        <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: '#1e293b' }}
          dangerouslySetInnerHTML={{
            __html: blocks
              .map(b => b.content?.html || '')
              .filter(Boolean)
              .join('\n'),
          }}
        />
      </div>

      {/* Sticky top bar */}
      {!readOnly && (
        <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100 bg-white shrink-0 print:hidden">
          <span className={`text-xs ${saveError ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
            {saving ? 'Guardando…' : saveError ? '⚠ Error al guardar — Cmd+S para reintentar' : lastSaved ? relativeTime(lastSaved) : 'Sin guardar aún'}
          </span>

          <div className="flex items-center gap-2">
            {/* Page status */}
            <PageStatusBadge status={pageStatus} onChange={handleStatusChange} />

            {/* Favorite */}
            <button
              onClick={handleToggleFavorite}
              title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              className={`p-1.5 rounded-lg transition-colors ${isFavorite ? 'text-amber-400 hover:text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            {/* Width toggle */}
            <button
              onClick={handleToggleWidth}
              title={fullWidth ? 'Vista centrada' : 'Vista ancho completo'}
              className={`p-1.5 rounded-lg transition-colors ${fullWidth ? 'text-[#17394f] bg-[#17394f]/8' : 'text-slate-300 hover:text-slate-600'}`}
            >
              {fullWidth ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Comments */}
            <button
              onClick={() => setShowComments(c => !c)}
              title="Comentarios"
              className={`p-1.5 rounded-lg transition-colors ${showComments ? 'text-[#17394f] bg-[#17394f]/8' : 'text-slate-300 hover:text-slate-600'}`}
            >
              <MessageCircle className="w-4 h-4" />
            </button>

            {/* Share */}
            <button
              onClick={() => setShowShare(true)}
              title="Compartir"
              className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Version history */}
            <button
              onClick={handleShowVersions}
              title="Historial de versiones"
              className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 transition-colors"
            >
              <Clock className="w-4 h-4" />
            </button>

            {/* Print / PDF */}
            <button
              onClick={handlePrint}
              title="Exportar / Imprimir"
              className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* More options */}
            <div className="relative">
              <button
                onClick={() => setShowOptions(o => !o)}
                className={`p-1.5 rounded-lg transition-colors ${showOptions ? 'bg-slate-100 text-slate-700' : 'text-slate-300 hover:text-slate-600'}`}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showOptions && (
                <>
                  <div className="fixed inset-0 z-[190]" onClick={() => setShowOptions(false)} />
                  <div className="absolute right-0 top-full mt-1 z-[200] bg-white rounded-xl shadow-xl border border-slate-200 py-1 min-w-[180px]">
                    <button
                      onClick={handleDuplicate}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <Copy className="w-4 h-4 text-slate-400" />
                      Duplicar página
                    </button>
                    <button
                      onClick={handleExportMarkdown}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <Download className="w-4 h-4 text-slate-400" />
                      Exportar a Markdown
                    </button>
                    <button
                      onClick={handleExportPdf}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <Download className="w-4 h-4 text-red-400" />
                      Exportar a PDF
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={handleToggleTemplate}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <LayoutTemplate className="w-4 h-4 text-slate-400" />
                      {isTemplate ? 'Quitar como template' : 'Guardar como template'}
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={() => setShowOptions(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 text-left"
                    >
                      <X className="w-4 h-4" />
                      Cerrar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content area with optional TOC */}
      <div className="flex-1 overflow-y-auto flex">
        <div className="flex-1 min-w-0">

          {/* Cover image */}
          {cover && (
            <div className="relative group/cover h-48 w-full overflow-hidden bg-slate-100">
              <img src={cover} alt="Portada" className="w-full h-full object-cover" />
              {!readOnly && (
                <div className="absolute inset-0 bg-black/0 group-hover/cover:bg-black/20 transition-colors flex items-end justify-end p-3 gap-2 opacity-0 group-hover/cover:opacity-100">
                  <button onClick={() => { setCoverInputValue(cover ?? ''); setShowCoverInput(true) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-medium text-slate-700 hover:bg-white transition-colors shadow-sm">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Cambiar
                  </button>
                  <button onClick={() => handleCoverSave('')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-medium text-slate-700 hover:bg-white transition-colors shadow-sm">
                    <X className="w-3.5 h-3.5" />
                    Quitar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cover URL input panel */}
          {showCoverInput && !readOnly && (
            <div className="border-b border-slate-100 bg-slate-50 px-8 py-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                autoFocus
                value={coverInputValue}
                onChange={e => setCoverInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCoverSave(coverInputValue)
                  if (e.key === 'Escape') setShowCoverInput(false)
                }}
                placeholder="Pegar URL de imagen..."
                className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-300"
              />
              <button onClick={() => handleCoverSave(coverInputValue)}
                className="px-3 py-1 bg-[#17394f] text-white text-xs rounded-lg hover:bg-[#17394f]/90 transition-colors">
                Aplicar
              </button>
              <button onClick={() => setShowCoverInput(false)}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        <div className={`${fullWidth ? 'px-12 py-10' : 'max-w-3xl mx-auto px-16 py-12'}`}>
          {/* Page icon + hover controls */}
          <div
            className="relative mb-3"
            onMouseEnter={() => setTitleHovered(true)}
            onMouseLeave={() => setTitleHovered(false)}
          >
            <div className="relative inline-block">
              {icon ? (
                <button
                  onClick={() => !readOnly && setShowEmojiPicker(e => !e)}
                  className={`text-5xl leading-none ${!readOnly ? 'hover:opacity-80 transition-opacity' : ''} select-none`}
                  title="Cambiar ícono"
                >
                  {icon}
                </button>
              ) : (
                !readOnly && (
                  <button
                    onClick={() => setShowEmojiPicker(e => !e)}
                    className={`flex items-center gap-1.5 text-sm text-slate-300 hover:text-slate-500 transition-colors py-1 ${titleHovered ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <Smile className="w-4 h-4" />
                    Agregar ícono
                  </button>
                )
              )}
              {showEmojiPicker && !readOnly && (
                <EmojiPickerPanel onSelect={handleIconSelect} onClose={() => setShowEmojiPicker(false)} />
              )}
            </div>

            {/* Add cover button (only when no cover) */}
            {!readOnly && !cover && titleHovered && !showCoverInput && (
              <button
                onClick={() => setShowCoverInput(true)}
                className="ml-3 flex items-center gap-1.5 text-sm text-slate-300 hover:text-slate-500 transition-colors py-1 inline-flex align-middle"
              >
                <ImageIcon className="w-4 h-4" />
                Añadir portada
              </button>
            )}
          </div>

          {/* Title */}
          {readOnly ? (
            <h1 className="text-4xl font-bold text-slate-900 mb-10 leading-tight">{title}</h1>
          ) : (
            <div
              ref={titleRef}
              contentEditable
              suppressContentEditableWarning
              onInput={e => {
                const t = e.currentTarget.innerText.replace(/\n$/, '')
                setTitle(t)
                saveTitle(t)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const first = blocks[0]
                  if (first) { setFocusedId(first.id); focusBlock(first.id) }
                }
              }}
              className="text-4xl font-bold text-slate-900 mb-10 leading-tight outline-none min-h-[1em] empty:before:content-['Sin_título'] empty:before:text-slate-200 empty:before:pointer-events-none w-full"
            />
          )}

          {/* Blocks */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {blocks.map(block => (
                  <DocBlockRenderer
                    key={block.id}
                    block={block}
                    focused={focusedId === block.id}
                    readOnly={readOnly}
                    users={users}
                    blockRef={el => {
                      if (el) blockRefs.current.set(block.id, el)
                      else blockRefs.current.delete(block.id)
                    }}
                    onUpdate={updateBlockContent}
                    onUpdateHtml={updateBlockHtml}
                    onEnter={id => addBlockAfter(id)}
                    onBackspaceEmpty={deleteBlock}
                    onFocus={setFocusedId}
                    onArrowUp={focusPrev}
                    onArrowDown={focusNext}
                    onSlash={(id, pos, filter) => setBlockMenu({ blockId: id, filter, position: pos })}
                    onSlashClose={() => setBlockMenu(null)}
                    onMoveUp={id => moveBlock(id, -1)}
                    onMoveDown={id => moveBlock(id, 1)}
                    onDelete={deleteBlock}
                    onDuplicate={duplicateBlock}
                    onConvert={convertBlock}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Click below blocks to add paragraph */}
          {!readOnly && (
            <div
              className="min-h-24 cursor-text"
              onClick={() => {
                const last = blocks[blocks.length - 1]
                if (last && (last.type === 'paragraph' && !(last.content.html ?? '').trim())) {
                  setFocusedId(last.id); focusBlock(last.id)
                } else {
                  addBlockAfter(blocks[blocks.length - 1]?.id ?? '')
                }
              }}
            />
          )}

          {/* Backlinks */}
          {backlinks.length > 0 && (
            <div className="mt-8 pt-4 border-t border-slate-100 print:hidden">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Mencionado en
              </p>
              <div className="space-y-1">
                {backlinks.map(bl => (
                  <a
                    key={bl.id}
                    href={`/docs/${bl.id}`}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-[#17394f] hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors"
                  >
                    <span>{bl.icon ?? '📄'}</span>
                    <span className="truncate">{bl.title || 'Sin título'}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Table of Contents — disabled */}
        {/* {!readOnly && !showComments && <DocTOC blocks={blocks} />} */}

        {/* Comments side panel */}
        {showComments && (
          <div className="w-80 shrink-0 border-l border-slate-100 bg-white flex flex-col print:hidden">
            <CommentsPanel pageId={page.id} currentUserId={currentUserId} isAdmin={isAdmin} />
          </div>
        )}
      </div>

      {/* / Block menu */}
      {blockMenu && (
        <BlockMenu
          filter={blockMenu.filter}
          position={blockMenu.position}
          onSelect={handleBlockMenuSelect}
          onClose={() => setBlockMenu(null)}
        />
      )}

      {/* Inline formatting toolbar */}
      {!readOnly && <InlineToolbar onClose={() => {}} />}

      {/* Version history panel */}
      {showVersions && (
        <VersionHistoryPanel
          pageId={page.id}
          versions={versions}
          loading={versionsLoading}
          onClose={() => setShowVersions(false)}
          onRestore={handleRestoreVersion}
        />
      )}

      {/* Share modal */}
      {showShare && (
        <ShareModal pageId={page.id} pageTitle={title} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}
