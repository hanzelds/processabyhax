'use client'

import { useState, useRef, useCallback, useId } from 'react'
import { X, Upload, FileText, FileSpreadsheet, ChevronDown, Trash2, Check, Loader2, AlertCircle, ArrowUpDown, FileType } from 'lucide-react'
import { api } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ContextOption {
  type: 'workspace' | 'teamspace' | 'client'
  id: string
  label: string
  emoji?: string
}

interface ImportFile {
  uid: string
  filename: string
  title: string
  rawContent: string
  format: 'md' | 'csv' | 'pdf'
  role: 'root' | 'child'
  parentUid: string | null // uid of another file in the list
  // For PDFs, store the File object for FormData upload
  pdfFile?: File
  // Import status (per-file, set during handleImport)
  status?: 'pending' | 'importing' | 'done' | 'error'
  statusMsg?: string
}

interface NotionImportModalProps {
  contexts: ContextOption[]
  onClose: () => void
  onImported: (firstPageId: string) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function cleanNotionFilename(filename: string): string {
  return (filename
    .replace(/\.(md|csv|txt|pdf)$/i, '')
    .replace(/\s+[0-9a-f]{32}$/i, '')
    .trim()) || 'Sin título'
}

function isPdfFile(f: File): boolean {
  return f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
}

function uid8() {
  return Math.random().toString(36).slice(2, 10)
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f =>
      /\.(md|csv|txt|pdf)$/i.test(f.name)
    )
    if (files.length) onFiles(files)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) onFiles(files)
    e.target.value = ''
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        flex flex-col items-center justify-center gap-3 py-10 rounded-xl border-2 border-dashed cursor-pointer transition-all
        ${dragging ? 'border-[#17394f] bg-[#17394f]/5' : 'border-slate-200 hover:border-[#17394f]/40 hover:bg-slate-50'}
      `}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${dragging ? 'bg-[#17394f]/10' : 'bg-slate-100'}`}>
        <Upload className={`w-5 h-5 ${dragging ? 'text-[#17394f]' : 'text-slate-400'}`} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-700">Arrastra archivos aquí</p>
        <p className="text-xs text-slate-400 mt-0.5">o haz clic para seleccionar · <span className="font-medium">.md</span>, <span className="font-medium">.csv</span> y <span className="font-medium text-red-500">.pdf</span></p>
      </div>
      <input ref={inputRef} type="file" multiple accept=".md,.csv,.txt,.pdf" className="hidden" onChange={handleChange} />
    </div>
  )
}

function ParentSelect({ files, currentUid, value, onChange }: {
  files: ImportFile[]
  currentUid: string
  value: string | null
  onChange: (uid: string | null) => void
}) {
  const roots = files.filter(f => f.uid !== currentUid && f.role === 'root')
  if (roots.length === 0) return <span className="text-xs text-slate-400 italic">No hay páginas raíz</span>

  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 pr-7 appearance-none bg-white text-slate-700 outline-none focus:border-[#17394f] cursor-pointer"
      >
        <option value="">— Seleccionar página padre —</option>
        {roots.map(f => (
          <option key={f.uid} value={f.uid}>{f.title || f.filename}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export function NotionImportModal({ contexts, onClose, onImported }: NotionImportModalProps) {
  const defaultCtx = contexts.find(c => c.type === 'workspace') ?? contexts[0]
  const [selectedCtx, setSelectedCtx] = useState<ContextOption>(defaultCtx ?? { type: 'workspace', id: 'global', label: 'General', emoji: '📝' })
  const [files, setFiles] = useState<ImportFile[]>([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectId = useId()

  // Read files from disk and add them
  const handleNewFiles = useCallback(async (dropped: File[]) => {
    const newEntries = await Promise.all(dropped.map(async f => {
      const title = cleanNotionFilename(f.name)
      if (isPdfFile(f)) {
        return {
          uid: uid8(),
          filename: f.name,
          title,
          rawContent: '',
          format: 'pdf' as const,
          role: 'root' as const,
          parentUid: null,
          pdfFile: f,
        }
      }
      const text = await f.text()
      const format: 'md' | 'csv' = /\.csv$/i.test(f.name) ? 'csv' : 'md'
      return {
        uid: uid8(),
        filename: f.name,
        title,
        rawContent: text,
        format,
        role: 'root' as const,
        parentUid: null,
      }
    }))
    setFiles(prev => [...prev, ...newEntries])
    setError(null)
  }, [])

  function updateFile(uid: string, patch: Partial<ImportFile>) {
    setFiles(prev => prev.map(f => f.uid === uid ? { ...f, ...patch } : f))
  }

  function removeFile(uid: string) {
    setFiles(prev => {
      const next = prev.filter(f => f.uid !== uid)
      // Reset parentUid references that pointed to removed file
      return next.map(f => f.parentUid === uid ? { ...f, parentUid: null, role: 'root' } : f)
    })
  }

  function moveFile(uid: string, direction: -1 | 1) {
    setFiles(prev => {
      const idx = prev.findIndex(f => f.uid === uid)
      if (idx < 0) return prev
      const next = [...prev]
      const target = idx + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  async function handleImport() {
    if (files.length === 0) return
    setError(null)

    // Validate: all children must have a parent
    const missingParent = files.filter(f => f.role === 'child' && !f.parentUid)
    if (missingParent.length > 0) {
      setError(`Asigna una página padre para: ${missingParent.map(f => f.title).join(', ')}`)
      return
    }

    setImporting(true)

    // Mark all as pending
    setFiles(prev => prev.map(f => ({ ...f, status: 'pending' as const, statusMsg: undefined })))

    let firstPageId: string | null = null

    try {
      // ── PDFs: upload one by one via FormData ──
      const pdfFiles = files.filter(f => f.format === 'pdf')
      for (const pf of pdfFiles) {
        setFiles(prev => prev.map(f => f.uid === pf.uid ? { ...f, status: 'importing' } : f))
        try {
          const fd = new FormData()
          fd.append('file', pf.pdfFile!)
          fd.append('contextType', selectedCtx.type)
          fd.append('contextId', selectedCtx.id)
          fd.append('title', pf.title)
          const res = await fetch('/api/docs/import-pdf', { method: 'POST', body: fd, credentials: 'include' })
          const data = await res.json()
          if (res.ok) {
            if (!firstPageId) firstPageId = data.pageId
            setFiles(prev => prev.map(f => f.uid === pf.uid
              ? { ...f, status: 'done', statusMsg: `✓ ${data.blocksCreated} bloques · ${data.pagesInPdf} pág.` }
              : f
            ))
          } else {
            setFiles(prev => prev.map(f => f.uid === pf.uid
              ? { ...f, status: 'error', statusMsg: data.error ?? 'Error al importar' }
              : f
            ))
          }
        } catch {
          setFiles(prev => prev.map(f => f.uid === pf.uid ? { ...f, status: 'error', statusMsg: 'Error de red' } : f))
        }
      }

      // ── Markdown/CSV: batch import ──
      const textFiles = files.filter(f => f.format !== 'pdf')
      if (textFiles.length > 0) {
        // Mark text files as importing
        setFiles(prev => prev.map(f => f.format !== 'pdf' ? { ...f, status: 'importing' } : f))
        const items = textFiles.map(f => ({
          title:       f.title,
          rawContent:  f.rawContent,
          format:      f.format as 'md' | 'csv',
          parentIndex: f.role === 'child' && f.parentUid
            ? files.findIndex(x => x.uid === f.parentUid)
            : undefined,
        }))

        const result = await api.post<{ created: { title: string; id: string }[]; failed: { title: string; id: null }[]; firstPageId: string | null }>(
          '/api/docs/import',
          { contextType: selectedCtx.type, contextId: selectedCtx.id, items }
        )

        if (!firstPageId && result.firstPageId) firstPageId = result.firstPageId
        const createdTitles = new Set(result.created.map(c => c.title))
        setFiles(prev => prev.map(f => {
          if (f.format === 'pdf') return f
          return createdTitles.has(f.title)
            ? { ...f, status: 'done' as const }
            : { ...f, status: 'error' as const, statusMsg: 'No se pudo crear' }
        }))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al importar')
      setFiles(prev => prev.map(f => f.status === 'importing' ? { ...f, status: 'error', statusMsg: 'Error inesperado' } : f))
    } finally {
      setImporting(false)
      // Navigate to first created page after a short delay so user sees statuses
      if (firstPageId) {
        setTimeout(() => onImported(firstPageId!), 800)
      }
    }
  }

  const rootCount  = files.filter(f => f.role === 'root').length
  const childCount = files.filter(f => f.role === 'child').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-base select-none">N</div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Importar documentos</h2>
              <p className="text-xs text-slate-400">Sube archivos .md, .csv de Notion o .pdf</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Context selector */}
          <div>
            <label htmlFor={selectId} className="block text-xs font-medium text-slate-600 mb-1.5">Destino</label>
            <div className="relative">
              <select
                id={selectId}
                value={`${selectedCtx.type}:${selectedCtx.id}`}
                onChange={e => {
                  const found = contexts.find(c => `${c.type}:${c.id}` === e.target.value)
                  if (found) setSelectedCtx(found)
                }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 pr-8 appearance-none bg-white text-slate-700 outline-none focus:border-[#17394f] focus:ring-1 focus:ring-[#17394f] cursor-pointer"
              >
                {contexts.map(c => (
                  <option key={`${c.type}:${c.id}`} value={`${c.type}:${c.id}`}>
                    {c.emoji ? `${c.emoji} ` : ''}{c.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Drop zone */}
          <DropZone onFiles={handleNewFiles} />

          {/* How-to hint */}
          {files.length === 0 && (
            <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500 space-y-1.5">
              <p className="font-medium text-slate-600">¿Cómo exportar de Notion?</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Abre la página en Notion → <span className="font-medium">···</span> (tres puntos) → <span className="font-medium">Exportar</span></li>
                <li>Escoge formato <span className="font-mono bg-white border border-slate-200 rounded px-1">Markdown & CSV</span></li>
                <li>Descomprime el ZIP y sube los archivos <span className="font-mono">.md</span> y <span className="font-mono">.csv</span> aquí</li>
              </ol>
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-600">
                  {files.length} archivo{files.length !== 1 ? 's' : ''} ·
                  <span className="text-[#17394f]"> {rootCount} página{rootCount !== 1 ? 's' : ''} raíz</span>
                  {childCount > 0 && <span className="text-slate-400"> · {childCount} subpágina{childCount !== 1 ? 's' : ''}</span>}
                </p>
                <button onClick={() => setFiles([])} className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">
                  Limpiar todo
                </button>
              </div>

              {files.map((f, idx) => (
                <div key={f.uid} className={`border rounded-xl p-4 transition-colors ${f.role === 'child' ? 'border-slate-200 bg-slate-50/60 ml-5 border-l-4 border-l-[#17394f]/20' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start gap-3">
                    {/* File type icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${f.format === 'pdf' ? 'bg-red-50' : 'bg-slate-100'}`}>
                      {f.format === 'csv'
                        ? <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        : f.format === 'pdf'
                          ? <FileType className="w-4 h-4 text-red-500" />
                          : <FileText className="w-4 h-4 text-[#17394f]" />}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2.5">
                      {/* Title input */}
                      <input
                        type="text"
                        value={f.title}
                        onChange={e => updateFile(f.uid, { title: e.target.value })}
                        placeholder="Título de la página"
                        className="w-full text-sm font-medium border-b border-transparent focus:border-slate-300 bg-transparent outline-none text-slate-800 placeholder:text-slate-300 transition-colors py-0.5"
                      />

                      {/* Filename label + format badge + status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-slate-400 truncate max-w-[180px]">{f.filename}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${
                          f.format === 'csv' ? 'bg-emerald-50 text-emerald-600'
                          : f.format === 'pdf' ? 'bg-red-50 text-red-600'
                          : 'bg-blue-50 text-blue-600'
                        }`}>
                          {f.format}
                        </span>
                        {f.status === 'importing' && <Loader2 className="w-3 h-3 animate-spin text-slate-400 shrink-0" />}
                        {f.status === 'done' && <span className="text-[10px] text-emerald-600 font-medium shrink-0">✓ {f.statusMsg ?? 'Importado'}</span>}
                        {f.status === 'error' && <span className="text-[10px] text-red-500 font-medium shrink-0">✗ {f.statusMsg ?? 'Error'}</span>}
                      </div>

                      {/* Role selector — PDFs are always root */}
                      {f.format !== 'pdf' && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                            <button
                              onClick={() => updateFile(f.uid, { role: 'root', parentUid: null })}
                              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${f.role === 'root' ? 'bg-white text-[#17394f] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Página raíz
                            </button>
                            <button
                              onClick={() => updateFile(f.uid, { role: 'child' })}
                              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${f.role === 'child' ? 'bg-white text-[#17394f] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              Subpágina
                            </button>
                          </div>
                          {f.role === 'child' && (
                            <div className="flex-1 min-w-[160px]">
                              <ParentSelect
                                files={files}
                                currentUid={f.uid}
                                value={f.parentUid}
                                onChange={uid => updateFile(f.uid, { parentUid: uid })}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      {f.format === 'pdf' && (
                        <p className="text-[10px] text-slate-400">PDF · siempre se crea como página raíz</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => moveFile(f.uid, -1)}
                        disabled={idx === 0}
                        title="Mover arriba"
                        className="w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-slate-500 disabled:opacity-30 transition-colors"
                      >
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeFile(f.uid)}
                        className="w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <p className="text-xs text-slate-400">
            {files.length === 0 ? 'Sube al menos un archivo para continuar' : `${files.length} archivo${files.length !== 1 ? 's' : ''} listo${files.length !== 1 ? 's' : ''}`}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 transition-colors text-slate-600">
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={importing || files.length === 0}
              className="flex items-center gap-2 bg-[#17394f] hover:bg-[#1e4a65] text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
            >
              {importing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Check className="w-3.5 h-3.5" />}
              {importing ? 'Importando…' : `Importar ${files.length > 0 ? files.length : ''} página${files.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
