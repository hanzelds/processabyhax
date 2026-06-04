'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Link2, Copy, Trash2, Check, ExternalLink, Loader2, X } from 'lucide-react'

interface Share {
  id: string
  token: string
  allowComments: boolean
  expiresAt: string | null
  createdAt: string
}

interface Props {
  pageId: string
  pageTitle: string
  onClose: () => void
}

export function ShareModal({ pageId, pageTitle, onClose }: Props) {
  const [shares, setShares]             = useState<Share[]>([])
  const [loading, setLoading]           = useState(true)
  const [allowComments, setAllowComments] = useState(false)
  const [creating, setCreating]         = useState(false)
  const [copied, setCopied]             = useState<string | null>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    api.get<Share[]>(`/api/docs/pages/${pageId}/shares`)
      .then(setShares)
      .finally(() => setLoading(false))
  }, [pageId])

  async function create() {
    setCreating(true)
    try {
      const s = await api.post<Share & { url: string }>(`/api/docs/pages/${pageId}/share`, { allowComments })
      setShares(prev => [s, ...prev])
    } finally { setCreating(false) }
  }

  async function revoke(token: string) {
    await api.delete(`/api/docs/pages/${pageId}/shares/${token}`)
    setShares(prev => prev.filter(s => s.token !== token))
  }

  function copyLink(token: string) {
    const url = `${baseUrl}/docs/public/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#17394f]" />
            <h2 className="text-sm font-semibold text-slate-800">Compartir página</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">Cualquier persona con el enlace puede ver <span className="font-medium">"{pageTitle}"</span> sin necesidad de iniciar sesión.</p>

          {/* Create new */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={allowComments}
                onChange={e => setAllowComments(e.target.checked)}
                className="rounded border-slate-300 text-[#17394f] focus:ring-[#17394f]"
              />
              Permitir comentarios
            </label>
            <button
              onClick={create}
              disabled={creating}
              className="flex items-center gap-1.5 bg-[#17394f] text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-[#1e4a65] disabled:opacity-50 transition-colors shrink-0"
            >
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
              Crear enlace
            </button>
          </div>

          {/* Existing shares */}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
          ) : shares.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No hay enlaces activos</p>
          ) : (
            <div className="space-y-2">
              {shares.map(s => {
                const url = `${baseUrl}/docs/public/${s.token}`
                return (
                  <div key={s.token} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-slate-600 truncate">{url}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {s.allowComments ? '💬 Comentarios activos · ' : ''}
                        Creado {new Date(s.createdAt).toLocaleDateString('es-DO')}
                      </p>
                    </div>
                    <button onClick={() => copyLink(s.token)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#17394f] hover:bg-white transition-colors shrink-0" title="Copiar enlace">
                      {copied === s.token ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#17394f] hover:bg-white transition-colors shrink-0" title="Abrir en nueva pestaña">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button onClick={() => revoke(s.token)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-white transition-colors shrink-0" title="Revocar enlace">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
