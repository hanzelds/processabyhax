'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { User, Script, ScriptVersion, ScriptComment, ScriptStatus, ReelScene, CarouselSlide } from '@/types'
import { api } from '@/lib/api'
import { ReelEditor } from './ReelEditor'
import { CarouselEditor } from './CarouselEditor'
import { ScriptSidePanel } from './ScriptSidePanel'
import {
  ArrowLeft, ChevronDown, Save, Clock, CheckCircle2, Archive,
  FileText, MessageSquare, History, MoreHorizontal
} from 'lucide-react'

const STATUS_LABELS: Record<ScriptStatus, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  archivado: 'Archivado',
}

const STATUS_COLORS: Record<ScriptStatus, string> = {
  borrador: 'bg-slate-100 text-slate-600 border-slate-200',
  en_revision: 'bg-amber-100 text-amber-700 border-amber-200',
  aprobado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  archivado: 'bg-slate-100 text-slate-400 border-slate-200',
}

const STATUS_TRANSITIONS: Record<ScriptStatus, { label: string; next: ScriptStatus }[]> = {
  borrador:     [{ label: 'Enviar a revisión', next: 'en_revision' }],
  en_revision:  [{ label: 'Aprobar', next: 'aprobado' }, { label: 'Volver a borrador', next: 'borrador' }],
  aprobado:     [{ label: 'Archivar', next: 'archivado' }],
  archivado:    [{ label: 'Restaurar a borrador', next: 'borrador' }],
}

type SidePanel = 'brief' | 'versions' | 'comments'

interface Props {
  me: User
  initialScript: Script & { versions?: ScriptVersion[]; comments?: ScriptComment[] }
  users: User[]
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: NodeJS.Timeout
  return ((...args: any[]) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms) }) as T
}

export function ScriptEditorClient({ me, initialScript, users }: Props) {
  const router = useRouter()
  const isAdmin = me.role === 'ADMIN' || me.role === 'LEAD'
  const canEdit = isAdmin || initialScript.createdById === me.id

  const [script, setScript] = useState(initialScript)
  const [content, setContent] = useState<any[]>(initialScript.content as any[])
  const [title, setTitle] = useState(initialScript.title)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [sidePanel, setSidePanel] = useState<SidePanel | null>('brief')
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  const dirty = useRef(false)

  const saveNow = useCallback(async (currentContent: any[], currentTitle: string) => {
    setSaving(true); setSaveError(false)
    try {
      const updated = await api.patch<Script>(`/api/scripts/${script.id}`, {
        content: currentContent,
        title: currentTitle,
      })
      setScript(s => ({ ...s, ...updated }))
      setLastSaved(new Date())
      dirty.current = false
    } catch { setSaveError(true) }
    finally { setSaving(false) }
  }, [script.id])

  const saveDebounced = useCallback(debounce(saveNow, 2000), [saveNow])

  function handleContentChange(next: any[]) {
    setContent(next)
    dirty.current = true
    saveDebounced(next, title)
  }

  function handleTitleChange(next: string) {
    setTitle(next)
    dirty.current = true
    saveDebounced(content, next)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveNow(content, title)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [content, title, saveNow])

  async function changeStatus(next: ScriptStatus) {
    setShowStatusMenu(false)
    try {
      // Save current content first, then snapshot version
      await saveNow(content, title)
      const [updated] = await Promise.all([
        api.patch<Script>(`/api/scripts/${script.id}`, { status: next }),
        api.post(`/api/scripts/${script.id}/versions`, { notes: `Estado cambiado a ${STATUS_LABELS[next]}` }),
      ])
      setScript(s => ({ ...s, ...updated, status: next }))
    } catch { /* noop */ }
  }

  const transitions = STATUS_TRANSITIONS[script.status]

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-slate-100 flex-shrink-0">
        <button onClick={() => router.push('/content/scripts')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Title */}
        <input
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          disabled={!canEdit}
          className="flex-1 text-lg font-semibold text-slate-900 bg-transparent outline-none border-0 focus:ring-0 min-w-0"
        />

        {/* Status badge + menu */}
        <div className="relative">
          <button
            onClick={() => isAdmin && setShowStatusMenu(s => !s)}
            disabled={!isAdmin}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${STATUS_COLORS[script.status]} ${isAdmin ? 'cursor-pointer hover:opacity-80' : ''}`}
          >
            {STATUS_LABELS[script.status]}
            {isAdmin && <ChevronDown className="w-3 h-3" />}
          </button>
          {showStatusMenu && (
            <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30 min-w-[160px]">
              {transitions.map(t => (
                <button
                  key={t.next}
                  onClick={() => changeStatus(t.next)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Save status */}
        <div className="text-xs text-slate-400 flex-shrink-0 hidden sm:block">
          {saving ? 'Guardando...'
            : saveError ? <span className="text-red-500">Error — Cmd+S</span>
            : lastSaved ? `Guardado ${lastSaved.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`
            : null}
        </div>

        {/* Side panel toggles */}
        <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg p-0.5">
          {([
            ['brief', <FileText className="w-3.5 h-3.5" />, 'Brief'],
            ['comments', <MessageSquare className="w-3.5 h-3.5" />, 'Comentarios'],
            ['versions', <History className="w-3.5 h-3.5" />, 'Versiones'],
          ] as [SidePanel, React.ReactNode, string][]).map(([p, icon, label]) => (
            <button
              key={p}
              onClick={() => setSidePanel(sp => sp === p ? null : p)}
              title={label}
              className={`p-1.5 rounded transition-colors ${sidePanel === p ? 'bg-[#17394f] text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-auto">
          {script.type === 'reel' ? (
            <ReelEditor
              scenes={content as ReelScene[]}
              onChange={handleContentChange}
              readOnly={!canEdit}
              brief={script.brief}
            />
          ) : (
            <CarouselEditor
              slides={content as CarouselSlide[]}
              onChange={handleContentChange}
              readOnly={!canEdit}
              brief={script.brief}
            />
          )}
        </div>

        {/* Side panel */}
        {sidePanel && (
          <div className="w-80 flex-shrink-0 border-l border-slate-200 bg-white overflow-hidden flex flex-col">
            <ScriptSidePanel
              script={script}
              panel={sidePanel}
              me={me}
              users={users}
              onVersionRestore={async (v) => {
                const updated = await api.post<Script>(`/api/scripts/${script.id}/versions/${v.id}/restore`, {})
                setScript(s => ({ ...s, ...updated }))
                setContent(updated.content as any[])
                setTitle(updated.title)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
