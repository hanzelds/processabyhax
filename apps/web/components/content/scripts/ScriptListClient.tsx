'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Script, Client, ContentBrief, ScriptStatus } from '@/types'
import { api } from '@/lib/api'
import { FileText, Clapperboard, LayoutTemplate, Plus, Search, Clock, CheckCircle2, Archive, ChevronDown } from 'lucide-react'

const STATUS_LABELS: Record<ScriptStatus, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  archivado: 'Archivado',
}

const STATUS_COLORS: Record<ScriptStatus, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  en_revision: 'bg-amber-100 text-amber-700',
  aprobado: 'bg-emerald-100 text-emerald-700',
  archivado: 'bg-slate-100 text-slate-400',
}

const STATUS_ICONS: Record<ScriptStatus, React.ReactNode> = {
  borrador: <FileText className="w-3 h-3" />,
  en_revision: <Clock className="w-3 h-3" />,
  aprobado: <CheckCircle2 className="w-3 h-3" />,
  archivado: <Archive className="w-3 h-3" />,
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  reel: <Clapperboard className="w-4 h-4" />,
  carrusel: <LayoutTemplate className="w-4 h-4" />,
}

interface Props {
  me: User
  initialScripts: Script[]
  clients: Client[]
  briefs: ContentBrief[]
}

export function ScriptListClient({ me, initialScripts, clients, briefs }: Props) {
  const router = useRouter()
  const [scripts, setScripts] = useState(initialScripts)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ScriptStatus | ''>('')
  const [filterClientId, setFilterClientId] = useState('')
  const [creating, setCreating] = useState(false)
  const [briefId, setBriefId] = useState('')
  const [briefSearch, setBriefSearch] = useState('')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState('')
  const [showBriefDropdown, setShowBriefDropdown] = useState(false)

  const isAdmin = me.role === 'ADMIN' || me.role === 'LEAD'

  // Filter briefs by search text
  const filteredBriefs = useMemo(() => {
    if (!briefSearch.trim()) return briefs.slice(0, 30)
    const q = briefSearch.toLowerCase()
    return briefs.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.client.name.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [briefs, briefSearch])

  const selectedBrief = briefs.find(b => b.id === briefId)

  const filtered = useMemo(() => {
    return scripts.filter(s => {
      if (search && !s.title.toLowerCase().includes(search.toLowerCase()) &&
          !s.brief.title.toLowerCase().includes(search.toLowerCase()) &&
          !s.client.name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterStatus && s.status !== filterStatus) return false
      if (filterClientId && s.clientId !== filterClientId) return false
      return true
    })
  }, [scripts, search, filterStatus, filterClientId])

  function openCreate() {
    setBriefId(''); setBriefSearch(''); setTitle(''); setCreateError('')
    setCreating(true)
  }

  function closeCreate() {
    setCreating(false); setBriefId(''); setBriefSearch(''); setTitle(''); setCreateError('')
  }

  async function createScript() {
    if (!briefId) { setCreateError('Selecciona un brief'); return }
    if (!title.trim()) { setCreateError('Escribe un título para el guion'); return }
    setCreateError('')
    setSubmitting(true)
    try {
      const script = await api.post<Script>('/api/scripts', { briefId, title: title.trim() })
      router.push(`/content/scripts/${script.id}`)
    } catch (e: any) {
      setCreateError(e.message || 'Error al crear el guion')
    } finally {
      setSubmitting(false)
    }
  }

  const grouped = useMemo(() => {
    const map: Record<ScriptStatus, Script[]> = { borrador: [], en_revision: [], aprobado: [], archivado: [] }
    filtered.forEach(s => map[s.status].push(s))
    return map
  }, [filtered])

  const showingAll = !filterStatus

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 lg:px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900">Guiones</h1>
          <p className="text-sm text-slate-500 mt-0.5">Scripts de reels y carruseles</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar guion..."
              className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#17394f]/20 w-44"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as ScriptStatus | '')}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#17394f]/20 text-slate-600"
          >
            <option value="">Todos los estados</option>
            {(Object.keys(STATUS_LABELS) as ScriptStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {isAdmin && (
            <select
              value={filterClientId}
              onChange={e => setFilterClientId(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#17394f]/20 text-slate-600 max-w-[160px]"
            >
              <option value="">Todos los clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {isAdmin && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 bg-[#17394f] text-white text-sm px-3 py-1.5 rounded-lg hover:bg-[#17394f]/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo guion
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 lg:px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <FileText className="w-8 h-8 mb-2" />
            <p className="text-sm">No hay guiones{search ? ' que coincidan' : ''}</p>
            {isAdmin && !search && (
              <button onClick={openCreate} className="mt-3 text-sm text-[#17394f] font-medium hover:underline">
                Crear el primero
              </button>
            )}
          </div>
        ) : showingAll ? (
          <div className="space-y-6">
            {(Object.keys(grouped) as ScriptStatus[]).filter(s => grouped[s].length > 0).map(status => (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
                    {STATUS_ICONS[status]}
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-slate-400">{grouped[status].length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {grouped[status].map(s => <ScriptCard key={s.id} script={s} />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(s => <ScriptCard key={s.id} script={s} />)}
          </div>
        )}
      </div>

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeCreate}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Nuevo guion</h2>
            <div className="space-y-4">
              {/* Brief selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Brief asociado *</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowBriefDropdown(s => !s)}
                    className={`w-full text-left border rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2 outline-none focus:ring-2 focus:ring-[#17394f]/20 ${selectedBrief ? 'border-[#17394f]/40 bg-[#17394f]/5' : 'border-slate-200'}`}
                  >
                    {selectedBrief ? (
                      <span className="text-slate-800 font-medium truncate">
                        {selectedBrief.client.name} — {selectedBrief.title}
                      </span>
                    ) : (
                      <span className="text-slate-400">Selecciona un brief...</span>
                    )}
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </button>

                  {showBriefDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 flex flex-col max-h-64">
                      <div className="p-2 border-b border-slate-100 flex-shrink-0">
                        <input
                          autoFocus
                          value={briefSearch}
                          onChange={e => setBriefSearch(e.target.value)}
                          placeholder="Filtrar por título o cliente..."
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#17394f]/20"
                        />
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {filteredBriefs.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-4">Sin resultados</p>
                        ) : filteredBriefs.map(b => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => { setBriefId(b.id); setBriefSearch(''); setShowBriefDropdown(false) }}
                            className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2.5 hover:bg-slate-50 ${b.id === briefId ? 'bg-[#17394f]/5' : ''}`}
                          >
                            <span className="text-[#17394f] flex-shrink-0">
                              {TYPE_ICONS[b.type] ?? <FileText className="w-4 h-4" />}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 truncate">{b.title}</p>
                              <p className="text-xs text-slate-400">{b.client.name} · {b.type}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título del guion *</label>
                <input
                  autoFocus={!showBriefDropdown}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ej: Guion Reel Historia de marca..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#17394f]/20"
                  onKeyDown={e => e.key === 'Enter' && createScript()}
                />
              </div>

              {/* Error */}
              {createError && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={closeCreate} className="flex-1 border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={createScript}
                disabled={submitting}
                className="flex-1 bg-[#17394f] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#17394f]/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Creando...' : 'Crear guion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ScriptCard({ script }: { script: Script }) {
  const lines = (script.content as any[]).length

  return (
    <Link href={`/content/scripts/${script.id}`} className="block group">
      <div className="border border-slate-200 rounded-xl p-4 hover:border-[#17394f]/30 hover:shadow-sm transition-all bg-white">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#17394f]/10 text-[#17394f] flex items-center justify-center flex-shrink-0 mt-0.5">
            {TYPE_ICONS[script.type] ?? <FileText className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-slate-900 text-sm truncate group-hover:text-[#17394f]">{script.title}</p>
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[script.status]}`}>
                {STATUS_ICONS[script.status]}
                {STATUS_LABELS[script.status]}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{script.client.name} · {script.brief.title}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
              <span>{lines} {script.type === 'reel' ? 'escenas' : 'slides'}</span>
              <span>{script._count.comments} comentarios</span>
              <span>{script._count.versions} versiones</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
