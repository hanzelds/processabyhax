'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DocPageSummary, DocFavorite, DocPageStatus } from '@/types'
import { api } from '@/lib/api'
import { Plus, ChevronRight, FileText, Loader2, Trash2, Star, Home, LayoutTemplate } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { TemplatePickerModal } from './TemplatePickerModal'

// ── Status dot ────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<DocPageStatus, string> = {
  borrador:    'bg-slate-300',
  en_revision: 'bg-amber-400',
  aprobado:    'bg-emerald-400',
  archivado:   'bg-slate-200',
}

// ── Single page item (recursive) ──────────────────────────────────────────────

function PageItem({
  page,
  currentPageId,
  depth,
  isAdmin,
  onRefresh,
}: {
  page: DocPageSummary
  currentPageId: string
  depth: number
  isAdmin: boolean
  onRefresh: () => void
}) {
  const [open, setOpen] = useState(currentPageId === page.id || page.children.some(c => c.id === currentPageId))
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const toast   = useToast()
  const confirm = useConfirm()
  const isActive = page.id === currentPageId
  const hasChildren = page.children.length > 0
  const dotColor = STATUS_DOT[page.pageStatus as DocPageStatus] ?? 'bg-slate-300'

  async function addChild() {
    setCreating(true)
    try {
      const created = await api.post<{ id: string }>(`/api/docs/pages/${page.id}/children`, { title: 'Sin título' })
      setOpen(true)
      onRefresh()
      router.push(`/docs/${created.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al crear sub-página')
    } finally {
      setCreating(false)
    }
  }

  async function deletePage() {
    const ok = await confirm({
      title: 'Eliminar página',
      message: page.children.length > 0
        ? `¿Eliminar "${page.title || 'Sin título'}"? Esto eliminará también todas sus sub-páginas.`
        : `¿Eliminar "${page.title || 'Sin título'}"?`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    try {
      await api.delete(`/api/docs/pages/${page.id}`)
      onRefresh()
      if (isActive) router.back()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar página')
    }
  }

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-lg pr-1 transition-colors ${
          isActive ? 'bg-[#17394f]/8 text-[#17394f]' : 'hover:bg-slate-100 text-slate-600'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {/* Chevron / spacer */}
        <button
          onClick={() => setOpen(o => !o)}
          className="w-5 h-5 flex items-center justify-center shrink-0 text-slate-300 hover:text-slate-500"
        >
          {hasChildren ? (
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
          ) : (
            <span className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Icon + Title */}
        <Link href={`/docs/${page.id}`} className="flex items-center gap-1.5 flex-1 py-1.5 min-w-0">
          <span className="shrink-0">{page.icon ?? <FileText className="w-3.5 h-3.5" />}</span>
          <span className="text-sm truncate">{page.title || 'Sin título'}</span>
          {/* Status dot */}
          {page.pageStatus !== 'borrador' && (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} title={page.pageStatus} />
          )}
        </Link>

        {/* Actions (shown on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {creating ? (
            <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
          ) : (
            <button onClick={addChild} title="Añadir sub-página"
              className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-[#17394f] rounded">
              <Plus className="w-3 h-3" />
            </button>
          )}
          {isAdmin && (
            <button onClick={deletePage} title="Eliminar página"
              className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-500 rounded">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {open && hasChildren && (
        <div>
          {page.children.map(child => (
            <PageItem
              key={child.id}
              page={child}
              currentPageId={currentPageId}
              depth={depth + 1}
              isAdmin={isAdmin}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

interface Props {
  contextType: 'teamspace' | 'client' | 'workspace'
  contextId: string
  contextName: string
  contextEmoji?: string
  currentPageId: string
  initialPages: DocPageSummary[]
  isAdmin: boolean
}

export function DocSidebar({ contextType, contextId, contextName, contextEmoji, currentPageId, initialPages, isAdmin }: Props) {
  const [pages, setPages] = useState(initialPages)
  const [creating, setCreating] = useState(false)
  const [favorites, setFavorites] = useState<DocFavorite[]>([])
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const router = useRouter()
  const toast  = useToast()

  // Load user favorites
  useEffect(() => {
    api.get<DocFavorite[]>('/api/docs/favorites').then(f => {
      // filter to current context
      setFavorites(f.filter(fav => fav.page.contextType === contextType && fav.page.contextId === contextId))
    }).catch(() => {})
  }, [contextType, contextId])

  async function refresh() {
    try {
      const fresh = await api.get<DocPageSummary[]>(`/api/docs/${contextType}/${contextId}`)
      setPages(fresh)
    } catch {}
  }

  async function newRootPage() {
    setCreating(true)
    try {
      const created = await api.post<{ id: string }>(`/api/docs/${contextType}/${contextId}`, { title: 'Sin título' })
      await refresh()
      router.push(`/docs/${created.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al crear página')
    } finally {
      setCreating(false)
    }
  }

  const backHref = contextType === 'client'
    ? `/clients/${contextId}?tab=docs`
    : contextType === 'workspace'
    ? '/docs'
    : `/teamspaces/${contextId}`

  const homeHref = `/docs/home/${contextType}/${contextId}`

  return (
    <>
      <div className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col h-full">
        {/* Header */}
        <div className="px-3 py-4 border-b border-slate-100">
          <Link href={backHref} className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-[#17394f] transition-colors truncate">
            <span>{contextEmoji ?? '📚'}</span>
            <span className="truncate">{contextName}</span>
          </Link>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase tracking-wider pl-6">Documentos</p>
        </div>

        {/* Context home link */}
        <div className="px-2 pt-2">
          <Link
            href={homeHref}
            className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-500 hover:text-[#17394f] hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Inicio
          </Link>
        </div>

        {/* Favorites section */}
        {favorites.length > 0 && (
          <div className="px-2 pt-2">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-2 mb-1">Favoritos</p>
            {favorites.map(fav => (
              <Link
                key={fav.id}
                href={`/docs/${fav.page.id}`}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                  fav.page.id === currentPageId
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Star className="w-3 h-3 text-amber-400 fill-current shrink-0" />
                <span className="truncate">{fav.page.icon ? `${fav.page.icon} ` : ''}{fav.page.title || 'Sin título'}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Separator */}
        {favorites.length > 0 && (
          <div className="mx-3 mt-2 border-t border-slate-100" />
        )}

        {/* Pages list */}
        <div className="flex-1 overflow-y-auto py-2 px-1">
          {pages.filter(p => !p.isTemplate).map(page => (
            <PageItem
              key={page.id}
              page={page}
              currentPageId={currentPageId}
              depth={0}
              isAdmin={isAdmin}
              onRefresh={refresh}
            />
          ))}
          {pages.filter(p => !p.isTemplate).length === 0 && (
            <p className="text-xs text-slate-300 text-center py-8 px-4">Sin páginas aún</p>
          )}
        </div>

        {/* Bottom actions */}
        <div className="px-3 py-3 border-t border-slate-100 space-y-1">
          <button
            onClick={newRootPage}
            disabled={creating}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-500 hover:text-[#17394f] hover:bg-slate-50 rounded-lg transition-colors"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Nueva página
          </button>
          <button
            onClick={() => setShowTemplatePicker(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <LayoutTemplate className="w-4 h-4" />
            Desde template
          </button>
        </div>
      </div>

      {/* Template picker modal */}
      {showTemplatePicker && (
        <TemplatePickerModal
          contextType={contextType}
          contextId={contextId}
          onClose={() => setShowTemplatePicker(false)}
          onCreated={async (id) => {
            setShowTemplatePicker(false)
            await refresh()
            router.push(`/docs/${id}`)
          }}
        />
      )}
    </>
  )
}
