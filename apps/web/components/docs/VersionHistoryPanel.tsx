'use client'

import { useState } from 'react'
import { DocPageVersion } from '@/types'
import { api } from '@/lib/api'
import { X, RotateCcw, Eye, Loader2, Clock } from 'lucide-react'

interface Props {
  pageId: string
  versions: DocPageVersion[]
  loading: boolean
  onClose: () => void
  onRestore: (versionId: string) => void
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('es-DO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function VersionHistoryPanel({ versions, loading, onClose, onRestore }: Props) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previewContent, setPreviewContent] = useState<any[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  async function handlePreview(versionId: string) {
    setPreviewId(versionId)
    setPreviewLoading(true)
    try {
      const v = await api.get<{ content: unknown[] }>(`/api/docs/versions/${versionId}/content`)
      setPreviewContent(v.content)
    } catch {
      setPreviewContent(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9990] flex items-stretch">
      {/* Backdrop */}
      <div className="flex-1 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-800 text-sm">Historial de versiones</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto py-2">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}

          {!loading && versions.length === 0 && (
            <div className="text-center py-10 px-4">
              <Clock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Sin versiones guardadas aún</p>
              <p className="text-xs text-slate-300 mt-1">Las versiones se crean automáticamente cada 5 minutos al editar</p>
            </div>
          )}

          {!loading && versions.map(v => (
            <div
              key={v.id}
              className={`mx-2 mb-1 rounded-lg border transition-colors ${
                previewId === v.id
                  ? 'border-[#17394f]/30 bg-[#17394f]/5'
                  : 'border-transparent hover:bg-slate-50'
              }`}
            >
              <button
                onClick={() => handlePreview(v.id)}
                className="w-full text-left px-3 py-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">v{v.version}</span>
                  <span className="text-[10px] text-slate-400">{v.savedBy.name}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{formatDate(v.createdAt)}</p>
              </button>

              {previewId === v.id && (
                <div className="px-3 pb-2.5 border-t border-slate-100 mt-1 pt-2">
                  {previewLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Cargando preview...
                    </div>
                  ) : previewContent !== null ? (
                    <div className="space-y-2">
                      {/* Content preview */}
                      <div className="text-xs text-slate-500 bg-slate-50 rounded p-2 max-h-32 overflow-y-auto">
                        {previewContent.slice(0, 5).map((block: { id?: string; type?: string; content?: { html?: string; items?: string[] } }, i) => {
                          const text = block.content?.html
                            ? block.content.html.replace(/<[^>]*>/g, '').trim()
                            : (block.content?.items ?? []).join(', ')
                          return text ? (
                            <p key={block.id ?? i} className="truncate text-[11px]">
                              {block.type === 'heading_1' || block.type === 'heading_2' || block.type === 'heading_3'
                                ? <strong>{text}</strong>
                                : text
                              }
                            </p>
                          ) : null
                        })}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onRestore(v.id)}
                          className="flex items-center gap-1 text-xs bg-[#17394f] text-white px-2.5 py-1.5 rounded-lg hover:bg-[#17394f]/90"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Restaurar
                        </button>
                        <button
                          onClick={() => { setPreviewId(null); setPreviewContent(null) }}
                          className="flex items-center gap-1 text-xs text-slate-500 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50"
                        >
                          <Eye className="w-3 h-3" />
                          Cerrar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No se pudo cargar el preview</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
          <p className="text-[11px] text-slate-400 text-center">
            Se guardan hasta 50 versiones automáticamente
          </p>
        </div>
      </div>
    </div>
  )
}
