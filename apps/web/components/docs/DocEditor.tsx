'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { DocBlock, DocBlockType, DocPage, DocPageStatus, DocPageVersion } from '@/types'
import { makeBlock, placeCursorAtEnd, placeCursorAtStart } from './docUtils'
import { DocBlockRenderer } from './DocBlock'
import { BlockMenu } from './BlockMenu'
import { InlineToolbar } from './InlineToolbar'
import { VersionHistoryPanel } from './VersionHistoryPanel'
import { api } from '@/lib/api'
import { Star, Clock, ChevronDown, Check, Printer, MoreHorizontal, LayoutTemplate, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { DocTOC } from './DocTOC'

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

// ── BlockMenu state ───────────────────────────────────────────────────────────

interface BlockMenuState {
  blockId: string
  filter: string
  position: { top: number; left: number }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  page: DocPage
  readOnly?: boolean
  onTitleChange?: (title: string) => void
  onPageCreated?: (newPageId: string, title: string) => void
}

export function DocEditor({ page, readOnly = false, onTitleChange, onPageCreated }: Props) {
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

  const blockRefs = useRef<Map<string, HTMLElement>>(new Map())
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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sticky top bar */}
      {!readOnly && (
        <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100 bg-white/80 backdrop-blur-sm shrink-0 print:hidden">
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
                  <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-slate-200 py-1 min-w-[180px]">
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
        <div className="max-w-3xl mx-auto px-16 py-12">
          {/* Page icon */}
          <div className="mb-2 text-5xl">{page.icon ?? ''}</div>

          {/* Title */}
          {readOnly ? (
            <h1 className="text-4xl font-bold text-slate-900 mb-10 leading-tight">{title}</h1>
          ) : (
            <div
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
              dangerouslySetInnerHTML={{ __html: title }}
            />
          )}

          {/* Blocks */}
          <div className="space-y-0.5">
            {blocks.map(block => (
              <DocBlockRenderer
                key={block.id}
                block={block}
                focused={focusedId === block.id}
                readOnly={readOnly}
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
        </div>
        </div>

        {/* Table of Contents (right panel, only when headings exist) */}
        {!readOnly && <DocTOC blocks={blocks} />}
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
    </div>
  )
}
