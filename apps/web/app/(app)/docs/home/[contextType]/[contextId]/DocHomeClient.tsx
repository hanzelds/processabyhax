'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DocHomeStats, DocPageSummary } from '@/types'
import { DocSidebar } from '@/components/docs/DocSidebar'
import { api } from '@/lib/api'
import {
  FileText, Clock, CheckCircle2, Archive, AlertCircle,
  Plus, Loader2, RotateCcw
} from 'lucide-react'

interface Props {
  contextType: 'teamspace' | 'client' | 'workspace'
  contextId: string
  contextName: string
  contextEmoji?: string
  stats: DocHomeStats
  initialTree: DocPageSummary[]
  isAdmin: boolean
}

const STATUS_CONFIG = {
  borrador:    { label: 'Borrador',    icon: FileText,     color: 'text-slate-600', bg: 'bg-slate-100' },
  en_revision: { label: 'En revisión', icon: AlertCircle,  color: 'text-amber-700', bg: 'bg-amber-100' },
  aprobado:    { label: 'Aprobado',    icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-100' },
  archivado:   { label: 'Archivado',   icon: Archive,      color: 'text-slate-400', bg: 'bg-slate-50 border border-slate-200' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)  return 'hace un momento'
  if (diff < 3600000) return `hace ${Math.floor(diff / 60000)} min`
  if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)} h`
  return `hace ${Math.floor(diff / 86400000)} d`
}

export function DocHomeClient({ contextType, contextId, contextName, contextEmoji, stats, initialTree, isAdmin }: Props) {
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  async function newPage() {
    setCreating(true)
    try {
      const page = await api.post<{ id: string }>(`/api/docs/${contextType}/${contextId}`, { title: 'Sin título' })
      router.push(`/docs/${page.id}`)
    } catch {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar */}
      <DocSidebar
        contextType={contextType}
        contextId={contextId}
        contextName={contextName}
        contextEmoji={contextEmoji}
        currentPageId=""
        initialPages={initialTree}
        isAdmin={isAdmin}
      />

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-12 py-12">
          {/* Header */}
          <div className="mb-10">
            <p className="text-sm text-slate-400 mb-1">{contextEmoji} {contextName}</p>
            <h1 className="text-3xl font-bold text-slate-900">Documentos</h1>
            <p className="text-slate-500 mt-1.5 text-sm">Página de inicio del espacio de documentos</p>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG['borrador']][]).map(([key, cfg]) => {
              const Icon = cfg.icon
              const count = stats.statusMap[key] ?? 0
              return (
                <div key={key} className={`rounded-xl p-4 ${cfg.bg}`}>
                  <div className={`flex items-center gap-2 ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-medium">{cfg.label}</span>
                  </div>
                  <p className={`text-3xl font-bold mt-2 ${cfg.color}`}>{count}</p>
                </div>
              )
            })}
          </div>

          {/* New page button */}
          <div className="mb-10">
            <button
              onClick={newPage}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-[#17394f] text-white rounded-xl text-sm font-medium hover:bg-[#17394f]/90 transition-colors disabled:opacity-60"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Nueva página
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Recent pages */}
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Modificadas recientemente
              </h2>
              {stats.recentPages.length === 0 ? (
                <p className="text-sm text-slate-400">Sin páginas aún</p>
              ) : (
                <div className="space-y-1">
                  {stats.recentPages.map(p => (
                    <Link
                      key={p.id}
                      href={`/docs/${p.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                    >
                      <span className="text-lg shrink-0">{p.icon ?? '📄'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate group-hover:text-[#17394f]">
                          {p.title || 'Sin título'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {p.updatedBy?.name ?? '–'} · {timeAgo(p.updatedAt)}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        STATUS_CONFIG[p.pageStatus as keyof typeof STATUS_CONFIG]?.bg ?? 'bg-slate-100'
                      } ${
                        STATUS_CONFIG[p.pageStatus as keyof typeof STATUS_CONFIG]?.color ?? 'text-slate-500'
                      }`}>
                        {STATUS_CONFIG[p.pageStatus as keyof typeof STATUS_CONFIG]?.label ?? p.pageStatus}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent versions */}
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-slate-400" />
                Versiones recientes
              </h2>
              {stats.recentVersions.length === 0 ? (
                <p className="text-sm text-slate-400">Sin versiones guardadas aún</p>
              ) : (
                <div className="space-y-1">
                  {stats.recentVersions.map(v => (
                    <Link
                      key={v.id}
                      href={`/docs/${v.page.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                    >
                      <span className="text-lg shrink-0">{v.page.icon ?? '📄'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate group-hover:text-[#17394f]">
                          {v.page.title || 'Sin título'}
                        </p>
                        <p className="text-xs text-slate-400">
                          v{v.version} · {v.savedBy.name} · {timeAgo(v.createdAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* All pages */}
          {stats.total > 0 && (
            <div className="mt-10">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                Todas las páginas ({stats.total})
              </h2>
              <div className="space-y-1">
                {initialTree.filter(p => !p.isTemplate).map(p => (
                  <PageTreeItem key={p.id} page={p} depth={0} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PageTreeItem({ page, depth }: { page: DocPageSummary; depth: number }) {
  return (
    <>
      <Link
        href={`/docs/${page.id}`}
        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors group text-sm"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        <span className="shrink-0">{page.icon ?? '📄'}</span>
        <span className="text-slate-700 group-hover:text-[#17394f] truncate">{page.title || 'Sin título'}</span>
        {page.pageStatus !== 'borrador' && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ml-auto ${
            page.pageStatus === 'aprobado' ? 'bg-emerald-100 text-emerald-700' :
            page.pageStatus === 'en_revision' ? 'bg-amber-100 text-amber-700' :
            'bg-slate-100 text-slate-400'
          }`}>
            {page.pageStatus === 'aprobado' ? 'Aprobado' :
             page.pageStatus === 'en_revision' ? 'En revisión' : 'Archivado'}
          </span>
        )}
      </Link>
      {page.children.map(child => (
        <PageTreeItem key={child.id} page={child} depth={depth + 1} />
      ))}
    </>
  )
}
