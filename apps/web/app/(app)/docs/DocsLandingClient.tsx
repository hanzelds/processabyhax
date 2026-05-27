'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DocPageSummary, DocPageStatus } from '@/types'
import { api } from '@/lib/api'
import { Plus, BookOpen, FileText, Loader2, Search, Download, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { NotionImportModal } from '@/components/docs/NotionImportModal'

interface Props {
  workspacePages: DocPageSummary[]
  teamspaceContexts: { id: string; name: string; emoji: string; pages: DocPageSummary[] }[]
  clientContexts: { id: string; name: string; pages: DocPageSummary[] }[]
  haxContext: { id: string; name: string; pages: DocPageSummary[] } | null
  isAdmin: boolean
}

const STATUS_BADGE: Record<DocPageStatus, { label: string; cls: string }> = {
  borrador:    { label: 'Borrador',    cls: 'bg-slate-100 text-slate-500' },
  en_revision: { label: 'En revisión', cls: 'bg-amber-100 text-amber-700' },
  aprobado:    { label: 'Aprobado',    cls: 'bg-emerald-100 text-emerald-700' },
  archivado:   { label: 'Archivado',   cls: 'bg-slate-50 text-slate-400 border border-slate-200' },
}

function PageCard({ page, context }: { page: DocPageSummary; context?: string }) {
  const badge = STATUS_BADGE[page.pageStatus as DocPageStatus] ?? STATUS_BADGE.borrador
  const hasChildren = page.children.length > 0

  return (
    <Link
      href={`/docs/${page.id}`}
      className="group flex flex-col bg-white border border-slate-200 rounded-xl p-4 hover:border-[#17394f]/30 hover:shadow-md transition-all duration-150"
    >
      {/* Icon */}
      <div className="text-3xl mb-3 select-none">
        {page.icon ?? <FileText className="w-7 h-7 text-slate-300" />}
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-slate-800 group-hover:text-[#17394f] transition-colors leading-snug mb-1 line-clamp-2">
        {page.title || 'Sin título'}
      </p>

      {/* Context breadcrumb */}
      {context && (
        <p className="text-[11px] text-slate-400 truncate mb-2">{context}</p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 mt-auto pt-2">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
        {hasChildren && (
          <span className="text-[10px] text-slate-400">{page.children.length} sub-pág.</span>
        )}
      </div>
    </Link>
  )
}

function SectionGrid({ title, icon, pages, context }: { title: string; icon: string; pages: DocPageSummary[]; context?: string }) {
  if (pages.length === 0) return null
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className="text-[11px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
          {pages.length}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {pages.map(page => (
          <PageCard key={page.id} page={page} context={context} />
        ))}
      </div>
    </section>
  )
}

export function DocsLandingClient({ workspacePages: initialPages, teamspaceContexts, clientContexts, haxContext, isAdmin }: Props) {
  const toast = useToast()
  const [pages, setPages] = useState(initialPages)
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showImport, setShowImport] = useState(false)
  const router = useRouter()

  // Build context list for import modal
  const importContexts = [
    ...(haxContext ? [{ type: 'client' as const, id: haxContext.id, label: 'HAX ESTUDIO CREATIVO', emoji: '⭐' }] : []),
    { type: 'workspace' as const, id: 'global', label: 'General', emoji: '📝' },
    ...teamspaceContexts.map(ts => ({ type: 'teamspace' as const, id: ts.id, label: ts.name, emoji: ts.emoji })),
    ...clientContexts.map(c => ({ type: 'client' as const, id: c.id, label: c.name, emoji: '🏢' })),
  ]

  async function newPage() {
    setCreating(true)
    try {
      const created = await api.post<{ id: string }>('/api/docs/workspace/global', {
        title: 'Sin título',
        icon: '📄',
      })
      router.push(`/docs/${created.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al crear página')
      setCreating(false)
    }
  }

  // Flatten all pages for search
  const allPages = [
    ...(haxContext?.pages ?? []).map(p => ({ page: p, context: 'Hax Estudio Creativo' })),
    ...pages.map(p => ({ page: p, context: 'General' })),
    ...teamspaceContexts.flatMap(ts => ts.pages.map(p => ({ page: p, context: ts.name }))),
    ...clientContexts.flatMap(c => c.pages.map(p => ({ page: p, context: c.name }))),
  ]

  const filtered = searchQuery.trim()
    ? allPages.filter(({ page }) => (page.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : null

  const hasAnything = (haxContext?.pages.length ?? 0) > 0 || pages.length > 0 || teamspaceContexts.some(t => t.pages.length > 0) || clientContexts.some(c => c.pages.length > 0)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <BookOpen className="w-5 h-5 text-[#17394f]" />
            <h1 className="text-2xl font-semibold text-slate-900">Docs</h1>
          </div>
          <p className="text-sm text-slate-500">
            Wiki interna del equipo — procesos, guías, referencias y más.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg px-3.5 py-2 hover:bg-slate-50 transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            Importar
          </button>
          <button
            onClick={newPage}
            disabled={creating}
            className="flex items-center gap-2 bg-[#17394f] text-white text-sm font-medium rounded-lg px-3.5 py-2 hover:bg-[#17394f]/90 transition-colors disabled:opacity-60 shrink-0"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Nueva página
          </button>
        </div>
      </div>

      {/* Search */}
      {hasAnything && (
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar en todos los docs..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#17394f]/40 focus:ring-2 focus:ring-[#17394f]/10 transition-colors text-slate-700 placeholder:text-slate-400"
          />
        </div>
      )}

      {/* Search results */}
      {filtered && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Resultados</h2>
            <span className="text-[11px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{filtered.length}</span>
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Sin resultados para &ldquo;{searchQuery}&rdquo;</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(({ page, context }) => (
                <PageCard key={page.id} page={page} context={context} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Content (hidden during search) */}
      {!filtered && (
        <>
          {/* ── Hax Estudio Creativo (pinned) ── */}
          {haxContext && (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">⭐</span>
                  <h2 className="text-sm font-semibold text-slate-800">HAX ESTUDIO CREATIVO</h2>
                  {haxContext.pages.length > 0 && (
                    <span className="text-[11px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{haxContext.pages.length}</span>
                  )}
                  <span className="text-[10px] font-semibold text-[#17394f] bg-[#17394f]/8 rounded-full px-2 py-0.5 uppercase tracking-wide">Interno</span>
                </div>
                <Link
                  href={`/docs/home/client/${haxContext.id}`}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#17394f] hover:underline"
                >
                  Ver home
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              {haxContext.pages.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {haxContext.pages.map(page => <PageCard key={page.id} page={page} />)}
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-2">Sin páginas aún</p>
              )}
            </section>
          )}

          {/* ── Workspace docs ── */}
          {pages.length === 0 ? (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">📝</span>
                <h2 className="text-sm font-semibold text-slate-700">General</h2>
              </div>
              <button
                onClick={newPage}
                disabled={creating}
                className="w-full flex items-center gap-3 px-4 py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-[#17394f]/30 hover:text-[#17394f] transition-colors disabled:opacity-60"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span className="text-sm">Crear primera página general…</span>
              </button>
            </section>
          ) : (
            <SectionGrid title="General" icon="📝" pages={pages} />
          )}

          {/* ── Teamspace docs ── */}
          {teamspaceContexts.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Teamspaces</h2>
              {teamspaceContexts.filter(ts => ts.pages.length > 0).map(ts => (
                <div key={ts.id} className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{ts.emoji}</span>
                    <span className="text-sm font-medium text-slate-700">{ts.name}</span>
                    <span className="text-[11px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{ts.pages.length}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {ts.pages.map(page => <PageCard key={page.id} page={page} />)}
                  </div>
                </div>
              ))}
              {teamspaceContexts.every(ts => ts.pages.length === 0) && (
                <p className="text-sm text-slate-300 py-4">Sin páginas en teamspaces</p>
              )}
            </section>
          )}

          {/* ── Client docs ── */}
          {clientContexts.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Clientes</h2>
              {clientContexts.filter(c => c.pages.length > 0).map(c => (
                <div key={c.id} className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">🏢</span>
                    <span className="text-sm font-medium text-slate-700">{c.name}</span>
                    <span className="text-[11px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{c.pages.length}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {c.pages.map(page => <PageCard key={page.id} page={page} />)}
                  </div>
                </div>
              ))}
              {clientContexts.every(c => c.pages.length === 0) && (
                <p className="text-sm text-slate-300 py-4">Sin páginas de clientes</p>
              )}
            </section>
          )}

          {/* Empty state */}
          {!hasAnything && (
            <div className="text-center py-16 text-slate-300">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Usa el botón &ldquo;Nueva página&rdquo; para empezar</p>
            </div>
          )}
        </>
      )}

      {showImport && (
        <NotionImportModal
          contexts={importContexts}
          onClose={() => setShowImport(false)}
          onImported={(firstPageId) => {
            setShowImport(false)
            router.push(`/docs/${firstPageId}`)
          }}
        />
      )}
    </div>
  )
}
