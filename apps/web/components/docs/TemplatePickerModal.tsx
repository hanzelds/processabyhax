'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { X, LayoutTemplate, Loader2, FileText } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Template {
  id: string
  title: string
  icon?: string | null
  templateName?: string | null
  templateDesc?: string | null
  createdBy: { id: string; name: string }
  createdAt: string
}

interface Props {
  contextType: 'teamspace' | 'client' | 'workspace'
  contextId: string
  onClose: () => void
  onCreated: (newPageId: string) => void
}

export function TemplatePickerModal({ contextType, contextId, onClose, onCreated }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    api.get<Template[]>(`/api/docs/templates/${contextType}`).then(t => {
      setTemplates(t)
    }).catch(() => {
      toast.error('Error al cargar templates')
    }).finally(() => setLoading(false))
  }, [contextType, toast])

  async function applyTemplate(templateId: string, templateTitle: string) {
    setApplying(templateId)
    try {
      const page = await api.post<{ id: string }>('/api/docs/templates/apply', {
        templateId,
        contextType,
        contextId,
        title: templateTitle || 'Sin título',
      })
      onCreated(page.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al aplicar template')
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[70vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-800">Templates de documentos</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}

          {!loading && templates.length === 0 && (
            <div className="text-center py-12">
              <LayoutTemplate className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Sin templates disponibles</p>
              <p className="text-xs text-slate-400 mt-1">
                Para crear uno, abre una página y márcala como template desde el menú de opciones.
              </p>
            </div>
          )}

          {!loading && templates.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t.id, t.templateName || t.title)}
                  disabled={applying === t.id}
                  className="flex flex-col items-start gap-2 p-3 border border-slate-200 rounded-xl hover:border-[#17394f]/40 hover:bg-slate-50 transition-colors text-left disabled:opacity-60"
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-xl">{t.icon ?? <FileText className="w-5 h-5 text-slate-300" />}</span>
                    {applying === t.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 ml-auto" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 line-clamp-1">
                      {t.templateName || t.title || 'Sin título'}
                    </p>
                    {t.templateDesc && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.templateDesc}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">por {t.createdBy.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
