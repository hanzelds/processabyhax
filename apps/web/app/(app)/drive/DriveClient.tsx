'use client'

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { api } from '@/lib/api'
import {
  HardDrive, FolderOpen, Folder, ChevronRight, Search, X, ExternalLink,
  Image, FileText, Film, FileSpreadsheet, Presentation, File, RefreshCw,
  PlugZap, Link2Off, ArrowLeft, ZoomIn, Download, Upload, CheckSquare, Square,
  CheckCircle2, AlertCircle, Loader2, ChevronLeft, TriangleAlert, Trash2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
  thumbnailLink?: string
  iconLink?: string
  webViewLink?: string
  webContentLink?: string
  parents?: string[]
}

interface PinnedRoot {
  id: string
  name: string
  label: string
  isSharedDrive: boolean
}

interface DriveStatus {
  connected: boolean
  connectedBy: { id: string; name: string } | null
  connectedAt: string | null
}

interface BreadcrumbItem { id: string; name: string }

interface ContextMenuState {
  file: DriveFile
  x: number
  y: number
}

// ── Context menu ──────────────────────────────────────────────────────────────

interface ContextMenuActions {
  onPreview: (f: DriveFile) => void
  onDelete:  (f: DriveFile) => void
  onSelect:  (id: string)   => void
  isAdmin:   boolean
  selected:  Set<string>
}

const CtxActions = createContext<ContextMenuActions | null>(null)

function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const ctx   = useContext(CtxActions)!
  const ref   = useRef<HTMLDivElement>(null)
  const file  = menu.file
  const folder = file.mimeType === FOLDER_MIME
  const isSelected = ctx.selected.has(file.id)

  // Clamp to viewport
  const [pos, setPos] = useState({ x: menu.x, y: menu.y })
  useEffect(() => {
    if (!ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    setPos({
      x: Math.min(menu.x, window.innerWidth  - width  - 8),
      y: Math.min(menu.y, window.innerHeight - height - 8),
    })
  }, [menu.x, menu.y])

  useEffect(() => {
    function handler(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      onClose()
    }
    window.addEventListener('mousedown', handler)
    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('mousedown', handler); window.removeEventListener('keydown', handler) }
  }, [onClose])

  function item(icon: React.ReactNode, label: string, action: () => void, danger = false) {
    return (
      <button
        key={label}
        onMouseDown={e => { e.stopPropagation(); action(); onClose() }}
        className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg transition text-left
          ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100'}`}
      >
        <span className={`w-4 h-4 shrink-0 ${danger ? 'text-red-500' : 'text-slate-400'}`}>{icon}</span>
        {label}
      </button>
    )
  }

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top: pos.y, left: pos.x, zIndex: 9999 }}
      className="bg-white border border-slate-200 rounded-xl shadow-xl p-1 min-w-[180px]"
      onMouseDown={e => e.stopPropagation()}
    >
      <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px]">
        {file.name}
      </p>
      <div className="h-px bg-slate-100 my-1" />

      {!folder && item(<ZoomIn className="w-4 h-4" />, 'Ver', () => ctx.onPreview(file))}
      {!folder && item(<Download className="w-4 h-4" />, 'Descargar', () => {
        const a = document.createElement('a')
        a.href = `/api/drive/files/${file.id}/download`
        a.download = file.name
        a.click()
      })}
      {file.webViewLink && item(<ExternalLink className="w-4 h-4" />, 'Abrir en Drive', () => {
        window.open(file.webViewLink, '_blank', 'noopener,noreferrer')
      })}

      {!folder && (
        <>
          <div className="h-px bg-slate-100 my-1" />
          {item(
            isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />,
            isSelected ? 'Deseleccionar' : 'Seleccionar',
            () => ctx.onSelect(file.id)
          )}
        </>
      )}

      {ctx.isAdmin && (
        <>
          <div className="h-px bg-slate-100 my-1" />
          {item(<Trash2 className="w-4 h-4" />, 'Eliminar', () => ctx.onDelete(file), true)}
        </>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FOLDER_MIME = 'application/vnd.google-apps.folder'

function isFolder(f: DriveFile) { return f.mimeType === FOLDER_MIME }
function isImage(f: DriveFile)  { return f.mimeType.startsWith('image/') }
function isVideo(f: DriveFile)  { return f.mimeType.startsWith('video/') }
function isPdf(f: DriveFile)    { return f.mimeType === 'application/pdf' }
function isSheet(f: DriveFile)  { return f.mimeType.includes('spreadsheet') }
function isSlide(f: DriveFile)  { return f.mimeType.includes('presentation') }
function isDoc(f: DriveFile)    { return f.mimeType.includes('document') }
function isRtf(f: DriveFile)    { return f.mimeType === 'application/rtf' || f.mimeType === 'text/rtf' }

function FileIcon({ file, size = 16 }: { file: DriveFile; size?: number }) {
  const s = size === 16 ? 'w-4 h-4' : 'w-5 h-5'
  if (isFolder(file)) return <FolderOpen className={`${s} text-yellow-500 shrink-0`} />
  if (isImage(file))  return <Image      className={`${s} text-pink-500 shrink-0`} />
  if (isVideo(file))  return <Film       className={`${s} text-purple-500 shrink-0`} />
  if (isPdf(file))    return <FileText   className={`${s} text-red-500 shrink-0`} />
  if (isSheet(file))  return <FileSpreadsheet className={`${s} text-green-600 shrink-0`} />
  if (isSlide(file))  return <Presentation    className={`${s} text-orange-500 shrink-0`} />
  if (isDoc(file))    return <FileText   className={`${s} text-blue-500 shrink-0`} />
  if (isRtf(file))    return <FileText   className={`${s} text-blue-400 shrink-0`} />
  return <File className={`${s} text-slate-400 shrink-0`} />
}

function fmtSize(bytes?: string) {
  if (!bytes) return null
  const n = parseInt(bytes)
  if (isNaN(n)) return null
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso?: string) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Preview modal ─────────────────────────────────────────────────────────────

function stripRtf(raw: string) {
  // Remove RTF control words, groups, and non-ASCII escape sequences
  return raw
    .replace(/\{\\[\w-]+[^}]*\}/g, '')   // remove groups like {\fonttbl ...}
    .replace(/\\[a-z]+\d*\s?/gi, '')      // remove control words like \rtf1 \par \b
    .replace(/\\\*/g, '')
    .replace(/[{}\\]/g, '')
    .replace(/\r\n|\r/g, '\n')
    .trim()
}

function PreviewModal({ file, files, onClose, onNav }: {
  file: DriveFile
  files: DriveFile[]
  onClose: () => void
  onNav: (f: DriveFile) => void
}) {
  const nonFolders = files.filter(f => !isFolder(f))
  const idx = nonFolders.findIndex(f => f.id === file.id)
  const hasPrev = idx > 0
  const hasNext = idx < nonFolders.length - 1

  const [rtfText, setRtfText] = useState<string | null>(null)
  const [rtfLoading, setRtfLoading] = useState(false)

  useEffect(() => {
    setRtfText(null)
    if (!isRtf(file)) return
    setRtfLoading(true)
    fetch(`/api/drive/files/${file.id}/thumbnail`, { credentials: 'include' })
      .then(r => r.text())
      .then(raw => setRtfText(stripRtf(raw)))
      .catch(() => setRtfText('No se pudo cargar el contenido.'))
      .finally(() => setRtfLoading(false))
  }, [file.id, file.mimeType])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft'  && hasPrev) onNav(nonFolders[idx - 1])
      if (e.key === 'ArrowRight' && hasNext) onNav(nonFolders[idx + 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, hasPrev, hasNext, onClose, onNav, nonFolders])

  const embedUrl = file.mimeType.startsWith('application/vnd.google-apps.')
    ? `https://drive.google.com/file/d/${file.id}/preview`
    : isImage(file) || isPdf(file)
    ? `/api/drive/files/${file.id}/thumbnail`
    : null

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon file={file} size={20} />
          <span className="text-white font-medium text-sm truncate">{file.name}</span>
          {nonFolders.length > 1 && (
            <span className="text-white/40 text-xs shrink-0">{idx + 1} / {nonFolders.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {file.webViewLink && (
            <a href={file.webViewLink} target="_blank" rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition">
              <ExternalLink className="w-3.5 h-3.5" /> Abrir en Drive
            </a>
          )}
          <a
            href={`/api/drive/files/${file.id}/download`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"
          >
            <Download className="w-3.5 h-3.5" /> Descargar
          </a>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content + nav arrows */}
      <div className="flex-1 flex items-center justify-center p-4 relative" onClick={e => e.stopPropagation()}>
        {hasPrev && (
          <button
            onClick={() => onNav(nonFolders[idx - 1])}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={() => onNav(nonFolders[idx + 1])}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {isRtf(file) ? (
          rtfLoading ? (
            <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
          ) : (
            <div className="w-full max-w-3xl h-[80vh] bg-white rounded-xl shadow-2xl overflow-y-auto">
              <pre className="p-8 text-sm text-slate-800 font-mono whitespace-pre-wrap break-words leading-relaxed">
                {rtfText}
              </pre>
            </div>
          )
        ) : embedUrl ? (
          isImage(file) ? (
            <img src={embedUrl} alt={file.name} className="max-h-[90vh] max-w-[90vw] w-auto h-auto rounded-xl object-contain shadow-2xl" />
          ) : (
            <iframe
              src={embedUrl}
              className="w-full max-w-4xl h-[80vh] rounded-xl bg-white shadow-2xl"
              allow="autoplay"
            />
          )
        ) : (
          <div className="text-center px-4">
            <FileIcon file={file} size={20} />
            <p className="text-white font-medium mt-4">{file.name}</p>
            <p className="text-white/50 text-sm mt-1 mb-4">Vista previa no disponible para este tipo de archivo</p>
            {file.webViewLink && (
              <a href={file.webViewLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white text-slate-900 font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-100 transition">
                <ExternalLink className="w-4 h-4" /> Abrir en Google Drive
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── File grid card ────────────────────────────────────────────────────────────

function FileCard({ file, onOpen, onPreview, selected, onToggleSelect, selectMode, isAdmin, onDelete, onContextMenu }: {
  file: DriveFile; onOpen: () => void; onPreview: () => void
  selected: boolean; onToggleSelect: () => void; selectMode: boolean
  isAdmin: boolean; onDelete: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const folder  = isFolder(file)
  const image   = isImage(file)
  const thumbUrl = file.thumbnailLink ? file.thumbnailLink.replace('=s220', '=s400') : null

  function handleClick(e: React.MouseEvent) {
    if (!folder && (e.metaKey || e.ctrlKey || selectMode)) { onToggleSelect(); return }
    if (folder) onOpen()
  }

  return (
    <div
      className={`group bg-white border rounded-2xl overflow-hidden transition-all cursor-pointer relative select-none
        ${selected
          ? 'border-[#17394f] ring-2 ring-[#17394f]/20 shadow-md'
          : 'border-slate-200 hover:border-[#17394f]/30 hover:shadow-md'}`}
      onClick={handleClick}
      onDoubleClick={folder ? onOpen : onPreview}
      onContextMenu={onContextMenu}
    >
      {!folder && (
        <button
          onClick={e => { e.stopPropagation(); onToggleSelect() }}
          className={`absolute top-2 left-2 z-10 rounded-md transition
            ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          {selected
            ? <CheckSquare className="w-4 h-4 text-[#17394f]" />
            : <Square className="w-4 h-4 text-white drop-shadow-md" />}
        </button>
      )}

      <div className={`relative aspect-video flex items-center justify-center ${folder ? 'bg-amber-50' : 'bg-slate-50'}`}>
        {image && thumbUrl
          ? <img src={thumbUrl} alt={file.name} className="w-full h-full object-cover" />
          : folder
          ? <Folder className="w-12 h-12 text-yellow-400" />
          : <FileIcon file={file} size={20} />
        }
        {!folder && !selected && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              onClick={e => { e.stopPropagation(); onPreview() }}
              className="bg-white/90 hover:bg-white text-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-lg transition"
            >
              <ZoomIn className="w-3.5 h-3.5" /> Ver
            </button>
            <a
              href={`/api/drive/files/${file.id}/download`}
              onClick={e => e.stopPropagation()}
              className="bg-white/90 hover:bg-white text-slate-800 rounded-xl p-1.5 shadow-lg transition"
              title="Descargar"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
            {isAdmin && (
              <button
                onClick={e => { e.stopPropagation(); onDelete() }}
                className="bg-red-500/90 hover:bg-red-500 text-white rounded-xl p-1.5 shadow-lg transition"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="px-3 py-2.5">
        <p className="text-sm font-medium text-slate-800 truncate leading-tight">{file.name}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {fmtDate(file.modifiedTime)}{fmtSize(file.size) ? ` · ${fmtSize(file.size)}` : ''}
        </p>
      </div>
    </div>
  )
}

// ── File list row ─────────────────────────────────────────────────────────────

function FileRow({ file, onOpen, onPreview, selected, onToggleSelect, selectMode, isAdmin, onDelete, onContextMenu }: {
  file: DriveFile; onOpen: () => void; onPreview: () => void
  selected: boolean; onToggleSelect: () => void; selectMode: boolean
  isAdmin: boolean; onDelete: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const folder = isFolder(file)

  function handleClick(e: React.MouseEvent) {
    if (!folder && (e.metaKey || e.ctrlKey || selectMode)) { onToggleSelect(); return }
    if (folder) onOpen()
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer group transition-colors select-none
        ${selected ? 'bg-[#17394f]/5' : 'hover:bg-slate-50'}`}
      onClick={handleClick}
      onDoubleClick={folder ? onOpen : onPreview}
      onContextMenu={onContextMenu}
    >
      {!folder ? (
        <button
          onClick={e => { e.stopPropagation(); onToggleSelect() }}
          className={`shrink-0 transition ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          {selected
            ? <CheckSquare className="w-4 h-4 text-[#17394f]" />
            : <Square className="w-4 h-4 text-slate-300" />}
        </button>
      ) : <span className="w-4 shrink-0" />}

      <FileIcon file={file} />
      <span className="flex-1 text-sm text-slate-800 truncate">{file.name}</span>
      <span className="text-xs text-slate-400 w-20 text-right shrink-0">{fmtSize(file.size) ?? '—'}</span>
      <span className="text-xs text-slate-400 w-28 text-right shrink-0 hidden sm:block">{fmtDate(file.modifiedTime) ?? ''}</span>
      {!folder && (
        <>
          <button
            onClick={e => { e.stopPropagation(); onPreview() }}
            className="opacity-0 group-hover:opacity-100 text-xs text-[#17394f] font-medium px-2 py-1 rounded-lg hover:bg-[#17394f]/10 transition shrink-0"
          >
            Ver
          </button>
          <a
            href={`/api/drive/files/${file.id}/download`}
            onClick={e => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#17394f] transition p-1 shrink-0"
            title="Descargar"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
          {isAdmin && (
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition p-1 shrink-0"
              title="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </>
      )}
      {file.webViewLink && (
        <a
          href={file.webViewLink} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition p-1 shrink-0"
          title="Abrir en Drive"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  )
}

// ── Upload toast ──────────────────────────────────────────────────────────────

type UploadState = 'uploading' | 'success' | 'error'

function UploadToast({ state, label }: { state: UploadState; label: string }) {
  const cfg = {
    uploading: { bg: 'bg-[#17394f]',   icon: <Loader2      className="w-4 h-4 animate-spin shrink-0" /> },
    success:   { bg: 'bg-emerald-600', icon: <CheckCircle2  className="w-4 h-4 shrink-0" /> },
    error:     { bg: 'bg-red-600',     icon: <AlertCircle   className="w-4 h-4 shrink-0" /> },
  }[state]
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 ${cfg.bg} text-white rounded-2xl px-5 py-3.5 shadow-2xl max-w-xs animate-in slide-in-from-bottom-2`}>
      {cfg.icon}
      <span className="text-sm font-semibold">{label}</span>
    </div>
  )
}

// ── Not connected screen ──────────────────────────────────────────────────────

function NotConnected({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20 px-4">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <HardDrive className="w-8 h-8 text-slate-400" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Google Drive no conectado</h2>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        {isAdmin
          ? 'Conecta Google Drive para explorar y compartir archivos del equipo directamente desde Processa.'
          : 'Un administrador debe conectar Google Drive para que puedas acceder a los archivos.'}
      </p>
      {isAdmin && (
        <a href="/api/drive/auth"
          className="inline-flex items-center gap-2 bg-[#17394f] hover:bg-[#17394f]/90 text-white font-semibold px-5 py-3 rounded-xl transition">
          <PlugZap className="w-4 h-4" /> Conectar Google Drive
        </a>
      )}
    </div>
  )
}

// ── Token expired screen ──────────────────────────────────────────────────────

function TokenExpired({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20 px-4">
      <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
        <TriangleAlert className="w-8 h-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Sesión de Drive expirada</h2>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        {isAdmin
          ? 'El acceso a Google Drive venció. Reconecta para continuar.'
          : 'El acceso a Google Drive venció. Pídele a un administrador que reconecte.'}
      </p>
      {isAdmin && (
        <a href="/api/drive/auth"
          className="inline-flex items-center gap-2 bg-[#17394f] hover:bg-[#17394f]/90 text-white font-semibold px-5 py-3 rounded-xl transition">
          <PlugZap className="w-4 h-4" /> Reconectar Google Drive
        </a>
      )}
    </div>
  )
}

// ── Drag overlay ──────────────────────────────────────────────────────────────

function DragOverlay() {
  return (
    <div className="absolute inset-0 z-30 bg-[#17394f]/10 border-2 border-dashed border-[#17394f]/50 rounded-2xl flex flex-col items-center justify-center pointer-events-none">
      <Upload className="w-10 h-10 text-[#17394f] mb-2" />
      <p className="text-[#17394f] font-semibold text-sm">Suelta los archivos aquí</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'list'

interface Props { isAdmin: boolean; initialStatus: DriveStatus }

export function DriveClient({ isAdmin, initialStatus }: Props) {
  const [status, setStatus]               = useState(initialStatus)
  const [roots, setRoots]                 = useState<PinnedRoot[]>([])
  const [files, setFiles]                 = useState<DriveFile[]>([])
  const [loading, setLoading]             = useState(false)
  const [loadError, setLoadError]         = useState<string | null>(null)
  const [tokenExpired, setTokenExpired]   = useState(false)
  const [folderId, setFolderId]           = useState<string | null>(null)
  const [currentRoot, setCurrentRoot]     = useState<PinnedRoot | null>(null)
  const [breadcrumbs, setBreadcrumbs]     = useState<BreadcrumbItem[]>([])
  const [preview, setPreview]             = useState<DriveFile | null>(null)
  const [viewMode, setViewMode]           = useState<ViewMode>('grid')
  const [search, setSearch]               = useState('')
  const [searchResults, setSearchResults] = useState<DriveFile[] | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  // Multi-select
  const [selected, setSelected]           = useState<Set<string>>(new Set())
  const [downloading, setDownloading]     = useState(false)

  // Context menu
  const [ctxMenu, setCtxMenu]             = useState<ContextMenuState | null>(null)

  // Upload
  const [uploading, setUploading]         = useState(false)
  const [uploadToast, setUploadToast]     = useState<{ state: UploadState; label: string } | null>(null)
  const [dragging, setDragging]           = useState(false)
  const dragCounter                       = useRef(0)
  const fileInputRef                      = useRef<HTMLInputElement>(null)
  const toastTimerRef                     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef                         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropZoneRef                       = useRef<HTMLDivElement>(null)
  const autoRefreshRef                    = useRef<ReturnType<typeof setInterval> | null>(null)

  const AUTO_REFRESH_MS = 30_000

  const loadFolder = useCallback(async (id: string, root: PinnedRoot) => {
    setLoading(true)
    setLoadError(null)
    setSearchResults(null)
    setSearch('')
    setSelected(new Set())
    try {
      const data = await api.get<DriveFile[]>(`/api/drive/files?folderId=${id}`)
      setFiles(data)
      setFolderId(id)
      setCurrentRoot(root)
      if (id === root.id) {
        setBreadcrumbs([{ id: root.id, name: root.name }])
      } else {
        const crumbs = await api.get<BreadcrumbItem[]>(`/api/drive/breadcrumb/${id}`)
        const rootIdx = crumbs.findIndex(c => c.id === root.id)
        setBreadcrumbs(rootIdx >= 0 ? crumbs.slice(rootIdx) : [{ id: root.id, name: root.name }, ...crumbs])
      }
    } catch (err: any) {
      if (err?.status === 403 || err?.message?.includes('403')) {
        setTokenExpired(true)
      } else {
        setLoadError('No se pudo cargar la carpeta. Verifica tu conexión.')
      }
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status.connected) {
      api.get<PinnedRoot[]>('/api/drive/roots').then(setRoots).catch(() => {})
    }
  }, [status.connected])

  // Search debounce
  useEffect(() => {
    if (!search.trim()) { setSearchResults(null); return }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      try {
        const results = await api.get<DriveFile[]>(`/api/drive/search?q=${encodeURIComponent(search)}`)
        setSearchResults(results)
      } catch { setSearchResults([]) }
    }, 400)
  }, [search])

  // Drag & drop
  function onDragEnter(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) setDragging(true)
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault() }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    if (!folderId) return
    handleUpload(e.dataTransfer.files)
  }

  async function disconnect() {
    if (!confirm('¿Desconectar Google Drive?')) return
    setDisconnecting(true)
    try {
      await api.delete('/api/drive/disconnect')
      setStatus({ connected: false, connectedBy: null, connectedAt: null })
      setFiles([]); setFolderId(null); setCurrentRoot(null)
    } finally { setDisconnecting(false) }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function clearSelection() { setSelected(new Set()) }

  function toggleSelectAll() {
    const nonFolderIds = (searchResults ?? files).filter(f => !isFolder(f)).map(f => f.id)
    if (nonFolderIds.every(id => selected.has(id))) {
      setSelected(new Set())
    } else {
      setSelected(new Set(nonFolderIds))
    }
  }

  async function deleteSingle(file: DriveFile) {
    const label = isFolder(file) ? `la carpeta "${file.name}"` : `"${file.name}"`
    if (!confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/api/drive/files/${file.id}`)
      setFiles(prev => prev.filter(f => f.id !== file.id))
      if (searchResults) setSearchResults(prev => prev!.filter(f => f.id !== file.id))
      if (preview?.id === file.id) setPreview(null)
    } catch {
      alert('No se pudo eliminar el archivo.')
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`¿Eliminar ${selected.size} archivo${selected.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return
    const ids = Array.from(selected)
    try {
      await Promise.all(ids.map(id => api.delete(`/api/drive/files/${id}`)))
      setFiles(prev => prev.filter(f => !ids.includes(f.id)))
      if (searchResults) setSearchResults(prev => prev!.filter(f => !ids.includes(f.id)))
      clearSelection()
    } catch {
      alert('Algunos archivos no pudieron eliminarse.')
      if (currentRoot && folderId) loadFolder(folderId, currentRoot)
    }
  }

  async function downloadSelected() {
    if (selected.size === 0) return
    setDownloading(true)
    try {
      const ids = Array.from(selected)
      if (ids.length === 1) {
        // Single file — direct download
        const file = (searchResults ?? files).find(f => f.id === ids[0])
        const a = document.createElement('a')
        a.href = `/api/drive/files/${ids[0]}/download`
        a.download = file?.name ?? ids[0]
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } else {
        // Multiple files — ZIP
        const res = await fetch('/api/drive/files/zip', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = 'archivos-drive.zip'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } finally {
      setDownloading(false)
      clearSelection()
    }
  }

  function showToast(state: UploadState, label: string, duration = 3500) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setUploadToast({ state, label })
    if (state !== 'uploading') {
      toastTimerRef.current = setTimeout(() => setUploadToast(null), duration)
    }
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !folderId) return
    const count = fileList.length
    setUploading(true)
    showToast('uploading', `Subiendo ${count} archivo${count !== 1 ? 's' : ''}…`)
    try {
      const formData = new FormData()
      formData.append('folderId', folderId)
      for (const f of Array.from(fileList)) formData.append('files', f)
      const res = await fetch('/api/drive/files/upload', {
        method: 'POST', credentials: 'include', body: formData,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('success', `${count} archivo${count !== 1 ? 's' : ''} subido${count !== 1 ? 's' : ''} correctamente`)
      if (currentRoot) await loadFolder(folderId, currentRoot)
    } catch {
      showToast('error', 'Error al subir. Verifica que Drive esté conectado.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Silent background refresh — no loading spinner, no clearing selection
  const silentRefresh = useCallback(async (id: string, root: PinnedRoot) => {
    try {
      const data = await api.get<DriveFile[]>(`/api/drive/files?folderId=${id}`)
      setFiles(data)
    } catch { /* ignore background errors */ }
  }, [])

  useEffect(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    if (!folderId || !currentRoot || searchResults) return
    autoRefreshRef.current = setInterval(() => {
      silentRefresh(folderId, currentRoot)
    }, AUTO_REFRESH_MS)
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current) }
  }, [folderId, currentRoot, searchResults, silentRefresh])

  function openCtxMenu(file: DriveFile, e: React.MouseEvent) {
    e.preventDefault()
    setCtxMenu({ file, x: e.clientX, y: e.clientY })
  }

  function goBack() {
    if (breadcrumbs.length < 2) { setFolderId(null); setCurrentRoot(null); setBreadcrumbs([]); setSelected(new Set()); return }
    const parent = breadcrumbs[breadcrumbs.length - 2]
    if (currentRoot) loadFolder(parent.id, currentRoot)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (tokenExpired) return <TokenExpired isAdmin={isAdmin} />
  if (!status.connected) return <NotConnected isAdmin={isAdmin} />

  const displayFiles  = searchResults ?? files
  const folders       = displayFiles.filter(isFolder)
  const nonFolders    = displayFiles.filter(f => !isFolder(f))
  const selectMode    = selected.size > 0
  const allSelected   = nonFolders.length > 0 && nonFolders.every(f => selected.has(f.id))

  const ctxActions: ContextMenuActions = {
    onPreview: setPreview,
    onDelete:  deleteSingle,
    onSelect:  toggleSelect,
    isAdmin,
    selected,
  }

  return (
    <CtxActions.Provider value={ctxActions}>
    <>
      <div
        ref={dropZoneRef}
        className="flex flex-col h-full p-4 lg:p-6 relative"
        onDragEnter={folderId ? onDragEnter : undefined}
        onDragLeave={folderId ? onDragLeave : undefined}
        onDragOver={folderId ? onDragOver : undefined}
        onDrop={folderId ? onDrop : undefined}
      >
        {dragging && <DragOverlay />}

        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {folderId && (
              <button
                onClick={goBack}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                title="Volver"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-9 h-9 bg-[#17394f]/10 rounded-xl flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5 text-[#17394f]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 leading-none">Google Drive</h1>
              {status.connectedBy && (
                <p className="text-xs text-slate-400 mt-0.5">Conectado por {status.connectedBy.name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {folderId && (
              <>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#17394f] border border-[#17394f]/30 px-3 py-2 rounded-xl hover:bg-[#17394f]/5 transition disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" /> Subir archivos
                </button>
              </>
            )}
            <button
              onClick={() => folderId && currentRoot ? loadFolder(folderId, currentRoot) : undefined}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition"
              title="Actualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {isAdmin && (
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 text-xs font-medium text-red-500 border border-red-200 px-3 py-2 rounded-xl hover:bg-red-50 transition disabled:opacity-50"
              >
                <Link2Off className="w-3.5 h-3.5" />
                {disconnecting ? 'Desconectando…' : 'Desconectar'}
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        {folderId && (
          <div className="relative mb-3 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar archivos en Drive…"
              className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17394f]/30"
            />
            {search && (
              <button onClick={() => { setSearch(''); setSearchResults(null) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Breadcrumb */}
        {folderId && !searchResults && (
          <div className="flex items-center gap-1 text-sm mb-3 flex-wrap shrink-0 min-w-0">
            <button
              onClick={() => { setFolderId(null); setCurrentRoot(null); setBreadcrumbs([]); setSelected(new Set()) }}
              className="flex items-center gap-1 text-slate-500 hover:text-[#17394f] transition font-medium shrink-0"
            >
              <HardDrive className="w-3.5 h-3.5" /> Inicio
            </button>
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.id} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <button
                  onClick={() => currentRoot && loadFolder(crumb.id, currentRoot)}
                  className={`truncate hover:text-[#17394f] transition max-w-[160px] ${i === breadcrumbs.length - 1 ? 'text-slate-800 font-semibold' : 'text-slate-500'}`}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
        )}

        {folderId && searchResults && (
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <button onClick={() => { setSearch(''); setSearchResults(null) }}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition">
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <span className="text-sm text-slate-400">
              {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "<strong>{search}</strong>"
            </span>
          </div>
        )}

        {/* Toolbar: count + select all + view toggle */}
        {folderId && (
          <div className="flex items-center justify-between mb-3 shrink-0 gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">{displayFiles.length} elemento{displayFiles.length !== 1 ? 's' : ''}</span>
              {nonFolders.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#17394f] transition"
                >
                  {allSelected
                    ? <CheckSquare className="w-3.5 h-3.5 text-[#17394f]" />
                    : <Square className="w-3.5 h-3.5" />}
                  {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </button>
              )}
            </div>
            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              {(['grid', 'list'] as ViewMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === m ? 'bg-[#17394f] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {m === 'grid' ? '⊞ Cuadrícula' : '≡ Lista'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* File area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Home */}
          {!folderId && !loading && (
            <div className="space-y-2">
              {roots.map(root => (
                <button
                  key={root.id}
                  onClick={() => loadFolder(root.id, root)}
                  className="w-full flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-4 hover:border-[#17394f]/40 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#17394f]/8 flex items-center justify-center shrink-0">
                    {root.isSharedDrive
                      ? <HardDrive className="w-5 h-5 text-[#17394f]" />
                      : <Folder className="w-5 h-5 text-yellow-500" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{root.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{root.label}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#17394f] ml-auto shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Cargando…
            </div>
          )}

          {/* Error */}
          {!loading && loadError && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <p className="text-sm text-slate-600 mb-4">{loadError}</p>
              <button
                onClick={() => folderId && currentRoot && loadFolder(folderId, currentRoot)}
                className="flex items-center gap-2 bg-[#17394f] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#17394f]/90 transition"
              >
                <RefreshCw className="w-4 h-4" /> Reintentar
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !loadError && folderId && displayFiles.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Folder className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{searchResults ? 'Sin resultados' : 'Carpeta vacía'}</p>
              {!searchResults && (
                <p className="text-xs mt-1 text-slate-300">Arrastra archivos aquí o usa "Subir archivos"</p>
              )}
            </div>
          )}

          {/* Grid */}
          {!loading && !loadError && folderId && displayFiles.length > 0 && viewMode === 'grid' && (
            <>
              {folders.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Carpetas</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {folders.map(f => (
                      <FileCard key={f.id} file={f}
                        onOpen={() => currentRoot && loadFolder(f.id, currentRoot)}
                        onPreview={() => setPreview(f)}
                        selected={selected.has(f.id)} onToggleSelect={() => toggleSelect(f.id)} selectMode={selectMode}
                        isAdmin={isAdmin} onDelete={() => deleteSingle(f)}
                        onContextMenu={e => openCtxMenu(f, e)} />
                    ))}
                  </div>
                </div>
              )}
              {nonFolders.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Archivos</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {nonFolders.map(f => (
                      <FileCard key={f.id} file={f}
                        onOpen={() => currentRoot && loadFolder(f.id, currentRoot)}
                        onPreview={() => setPreview(f)}
                        selected={selected.has(f.id)} onToggleSelect={() => toggleSelect(f.id)} selectMode={selectMode}
                        isAdmin={isAdmin} onDelete={() => deleteSingle(f)}
                        onContextMenu={e => openCtxMenu(f, e)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* List */}
          {!loading && !loadError && folderId && displayFiles.length > 0 && viewMode === 'list' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 bg-slate-50">
                <span className="w-4 shrink-0" />
                <span className="w-4 shrink-0" />
                <span className="flex-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-20 text-right">Tamaño</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28 text-right hidden sm:block">Modificado</span>
                <span className="w-24 shrink-0" />
              </div>
              {displayFiles.map(f => (
                <FileRow key={f.id} file={f}
                  onOpen={() => currentRoot && loadFolder(f.id, currentRoot)}
                  onPreview={() => setPreview(f)}
                  selected={selected.has(f.id)} onToggleSelect={() => toggleSelect(f.id)} selectMode={selectMode}
                  isAdmin={isAdmin} onDelete={() => deleteSingle(f)}
                  onContextMenu={e => openCtxMenu(f, e)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating selection bar */}
      {selectMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-[#17394f] text-white rounded-2xl px-5 py-3 shadow-2xl shadow-[#17394f]/30">
          <span className="text-sm font-semibold">{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>
          <div className="w-px h-5 bg-white/20" />
          <button
            onClick={downloadSelected} disabled={downloading}
            className="flex items-center gap-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-xl transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Descargando…' : 'Descargar'}
          </button>
          {isAdmin && (
            <>
              <div className="w-px h-5 bg-white/20" />
              <button
                onClick={deleteSelected}
                className="flex items-center gap-1.5 text-sm font-semibold bg-red-500/80 hover:bg-red-500 px-3 py-1.5 rounded-xl transition"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </>
          )}
          <button onClick={clearSelection} className="text-white/60 hover:text-white transition p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {preview && (
        <PreviewModal
          file={preview}
          files={searchResults ?? files}
          onClose={() => setPreview(null)}
          onNav={setPreview}
        />
      )}
      {uploadToast && <UploadToast state={uploadToast.state} label={uploadToast.label} />}
      {ctxMenu && <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />}
    </>
    </CtxActions.Provider>
  )
}
