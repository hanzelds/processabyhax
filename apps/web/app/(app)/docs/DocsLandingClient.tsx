'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DocPageSummary } from '@/types'
import { api } from '@/lib/api'
import { Plus, BookOpen, FileText, ChevronRight, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Props {
  workspacePages: DocPageSummary[]
  teamspaceContexts: { id: string; name: string; emoji: string; pages: DocPageSummary[] }[]
  clientContexts: { id: string; name: string; pages: DocPageSummary[] }[]
  isAdmin: boolean
}

function PageLink({ page }: { page: DocPageSummary }) {
  return (
    <Link
      href={`/docs/${page.id}`}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group"
    >
      <span className="text-base shrink-0">{page.icon ?? '📄'}</span>
      <span className="text-sm font-medium text-slate-700 group-hover:text-[#17394f] flex-1 transition-colors">
        {page.title || 'Sin título'}
      </span>
      {page.children.length > 0 && (
        <span className="text-[11px] text-slate-400 shrink-0">
          {page.children.length} sub-pág.
        </span>
      )}
      <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

export function DocsLandingClient({ workspacePages: initialPages, teamspaceContexts, clientContexts, isAdmin }: Props) {
  const toast = useToast()
  const [pages, setPages] = useState(initialPages)
  const [creating, setCreating] = useState(false)
  const router = useRouter()

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

  const hasAnyContext = teamspaceContexts.length > 0 || clientContexts.length > 0

  return (
    <div className="p-8 max-w-4xl mx-auto">
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
        <button
          onClick={newPage}
          disabled={creating}
          className="flex items-center gap-2 bg-[#17394f] text-white text-sm font-medium rounded-lg px-3.5 py-2 hover:bg-[#17394f]/90 transition-colors disabled:opacity-60 shrink-0"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Nueva página
        </button>
      </div>

      {/* ── Workspace docs (standalone) ── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <h2 className="text-sm font-semibold text-slate-700">General</h2>
            <span className="text-[11px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
              {pages.length} {pages.length === 1 ? 'página' : 'páginas'}
            </span>
          </div>
        </div>

        {pages.length === 0 ? (
          <button
            onClick={newPage}
            disabled={creating}
            className="w-full flex items-center gap-3 px-4 py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-[#17394f]/30 hover:text-[#17394f] transition-colors disabled:opacity-60"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="text-sm">Crear primera página general…</span>
          </button>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {pages.map(page => <PageLink key={page.id} page={page} />)}
          </div>
        )}
      </section>

      {/* ── Teamspace docs ── */}
      {teamspaceContexts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Teamspaces</h2>
          <div className="space-y-4">
            {teamspaceContexts.map(ts => (
              <div key={ts.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span>{ts.emoji}</span>
                  <span className="text-sm font-medium text-slate-700">{ts.name}</span>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden ml-6">
                  {ts.pages.map(page => <PageLink key={page.id} page={page} />)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Client docs ── */}
      {clientContexts.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Clientes</h2>
          <div className="space-y-4">
            {clientContexts.map(c => (
              <div key={c.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span>🏢</span>
                  <span className="text-sm font-medium text-slate-700">{c.name}</span>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden ml-6">
                  {c.pages.map(page => <PageLink key={page.id} page={page} />)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state when truly nothing exists anywhere */}
      {pages.length === 0 && !hasAnyContext && (
        <div className="text-center py-12 text-slate-300">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Usa el botón &quot;Nueva página&quot; para empezar</p>
        </div>
      )}
    </div>
  )
}
