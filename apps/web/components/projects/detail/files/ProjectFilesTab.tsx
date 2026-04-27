'use client'

import { useState, useRef, useCallback } from 'react'
import { ProjectFile, ProjectFileType } from '@/types'
import { Upload, X, Download, FileText, FileImage, FileVideo, FileAudio, Archive, File } from 'lucide-react'

// ── Labels & colours ──────────────────────────────────────────────────────────

const FILE_TYPE_LABELS: Record<ProjectFileType, string> = {
  brief:     'Brief',
  reference: 'Referencia',
  contract:  'Contrato',
  other:     'Otro',
}

const FILE_TYPE_COLORS: Record<ProjectFileType, string> = {
  brief:     'bg-blue-50 text-blue-700',
  reference: 'bg-purple-50 text-purple-700',
  contract:  'bg-emerald-50 text-emerald-700',
  other:     'bg-slate-100 text-slate-600',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function FileIcon({ mime, className }: { mime: string; className?: string }) {
  const cls = className ?? 'w-5 h-5'
  if (mime.startsWith('image/'))       return <FileImage className={cls} />
  if (mime.startsWith('video/'))       return <FileVideo className={cls} />
  if (mime.startsWith('audio/'))       return <FileAudio className={cls} />
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar'))
                                       return <Archive className={cls} />
  if (mime === 'application/pdf' || mime.includes('word') || mime.includes('excel') ||
      mime.includes('powerpoint') || mime.includes('presentation') || mime.includes('sheet'))
                                       return <FileText className={cls} />
  return <File className={cls} />
}

function extColor(mime: string): string {
  if (mime.startsWith('image/'))   return 'bg-pink-50 text-pink-600'
  if (mime.startsWith('video/'))   return 'bg-violet-50 text-violet-600'
  if (mime.startsWith('audio/'))   return 'bg-orange-50 text-orange-600'
  if (mime.includes('pdf'))        return 'bg-red-50 text-red-600'
  if (mime.includes('word'))       return 'bg-blue-50 text-blue-600'
  if (mime.includes('excel') || mime.includes('sheet')) return 'bg-green-50 text-green-600'
  if (mime.includes('powerpoint') || mime.includes('presentation')) return 'bg-orange-50 text-orange-600'
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return 'bg-yellow-50 text-yellow-600'
  return 'bg-slate-100 text-slate-500'
}

// ── Upload queue item ─────────────────────────────────────────────────────────

interface QueueItem {
  id: string
  file: File
  fileType: ProjectFileType
  progress: number   // 0-100
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

// ── File row ─────────────────────────────────────────────────────────────────

function FileRow({
  file, canDelete, projectId, onDelete,
}: {
  file: ProjectFile
  canDelete: boolean
  projectId: string
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const ext = file.originalName.split('.').pop()?.toUpperCase() ?? '?'

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${file.originalName}"?`)) return
    setDeleting(true)
    const res = await fetch(`/api/projects/${projectId}/files/${file.id}`, {
      method: 'DELETE', credentials: 'include',
    })
    if (res.ok) onDelete(file.id)
    else setDeleting(false)
  }

  return (
    <div className="group flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 ${extColor(file.mimeType)}`}>
        <FileIcon mime={file.mimeType} className="w-4 h-4" />
        <span className="text-[9px] font-bold mt-0.5 leading-none">{ext.slice(0,4)}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{file.originalName}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${FILE_TYPE_COLORS[file.fileType]}`}>
            {FILE_TYPE_LABELS[file.fileType]}
          </span>
          <span className="text-xs text-slate-400">{formatBytes(file.sizeBytes)}</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">{file.uploader.name}</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">{formatDate(file.createdAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={`/api/projects/${file.projectId}/files/${file.id}/download`}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#17394f] hover:bg-slate-100 transition-colors"
          title="Descargar"
        >
          <Download className="w-4 h-4" />
        </a>
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
            title="Eliminar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Queue row (uploading) ─────────────────────────────────────────────────────

function QueueRow({ item, onRemove }: { item: QueueItem; onRemove: (id: string) => void }) {
  const ext = item.file.name.split('.').pop()?.toUpperCase() ?? '?'
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex flex-col items-center justify-center shrink-0 text-slate-400">
        <File className="w-4 h-4" />
        <span className="text-[9px] font-bold mt-0.5">{ext.slice(0,4)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{item.file.name}</p>
        <div className="mt-1.5">
          {item.status === 'error' ? (
            <p className="text-xs text-red-500">{item.error}</p>
          ) : item.status === 'done' ? (
            <p className="text-xs text-emerald-600 font-medium">✓ Subido</p>
          ) : (
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-[#17394f] h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
      {(item.status === 'error' || item.status === 'done') && (
        <button
          onClick={() => onRemove(item.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-500 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  projectId: string
  initialFiles: ProjectFile[]
  currentUserId: string
  isAdmin: boolean
  isCompleted: boolean
}

export function ProjectFilesTab({ projectId, initialFiles, currentUserId, isAdmin, isCompleted }: Props) {
  const [files, setFiles]       = useState<ProjectFile[]>(initialFiles)
  const [queue, setQueue]       = useState<QueueItem[]>([])
  const [fileType, setFileType] = useState<ProjectFileType>('other')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Upload a single File object via XHR (for progress events)
  function uploadFile(queueId: string, file: File, type: ProjectFileType) {
    const form = new FormData()
    form.append('file', file)
    form.append('fileType', type)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/projects/${projectId}/files`)
    xhr.withCredentials = true

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      const pct = Math.round((e.loaded / e.total) * 100)
      setQueue(q => q.map(i => i.id === queueId ? { ...i, progress: pct, status: 'uploading' } : i))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const newFile: ProjectFile = JSON.parse(xhr.responseText)
        setFiles(prev => [newFile, ...prev])
        setQueue(q => q.map(i => i.id === queueId ? { ...i, progress: 100, status: 'done' } : i))
        // auto-remove done items after 3s
        setTimeout(() => setQueue(q => q.filter(i => i.id !== queueId)), 3000)
      } else {
        let msg = 'Error al subir'
        try { msg = JSON.parse(xhr.responseText).error ?? msg } catch {}
        setQueue(q => q.map(i => i.id === queueId ? { ...i, status: 'error', error: msg } : i))
      }
    }

    xhr.onerror = () => {
      setQueue(q => q.map(i => i.id === queueId ? { ...i, status: 'error', error: 'Error de red' } : i))
    }

    xhr.send(form)
  }

  function enqueue(selectedFiles: FileList | File[]) {
    const arr = Array.from(selectedFiles)
    const items: QueueItem[] = arr.map(f => ({
      id: uuidv4(),
      file: f,
      fileType,
      progress: 0,
      status: 'pending',
    }))
    setQueue(prev => [...prev, ...items])
    items.forEach(item => uploadFile(item.id, item.file, item.fileType))
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) enqueue(e.target.files)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])
  const onDragLeave = useCallback(() => setDragging(false), [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) enqueue(e.dataTransfer.files)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileType, projectId])

  const totalSize = files.reduce((s, f) => s + f.sizeBytes, 0)

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      {!isCompleted && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700">Subir archivos</p>
            <select
              value={fileType}
              onChange={e => setFileType(e.target.value as ProjectFileType)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#17394f]/20"
            >
              <option value="brief">Brief</option>
              <option value="reference">Referencia</option>
              <option value="contract">Contrato</option>
              <option value="other">Otro</option>
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors select-none ${
              dragging
                ? 'border-[#17394f] bg-[#17394f]/5'
                : 'border-slate-200 hover:border-[#17394f]/40 hover:bg-slate-50'
            }`}
          >
            <Upload className={`w-7 h-7 transition-colors ${dragging ? 'text-[#17394f]' : 'text-slate-300'}`} />
            <p className="text-sm font-medium text-slate-600">
              {dragging ? 'Suelta para subir' : 'Arrastra archivos aquí o haz clic'}
            </p>
            <p className="text-xs text-slate-400">
              Imágenes, videos, PDF, Word, Excel, PowerPoint, audio, ZIP y más
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleInput}
            />
          </div>

          {/* Upload queue */}
          {queue.length > 0 && (
            <div className="mt-4 divide-y divide-slate-100">
              {queue.map(item => (
                <QueueRow
                  key={item.id}
                  item={item}
                  onRemove={id => setQueue(q => q.filter(i => i.id !== id))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* File list */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {files.length} {files.length === 1 ? 'archivo' : 'archivos'}
            {files.length > 0 && <span className="font-normal text-slate-400 normal-case tracking-normal ml-1">· {formatBytes(totalSize)}</span>}
          </p>
        </div>

        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <File className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">Sin archivos adjuntos</p>
            {!isCompleted && <p className="text-xs text-slate-300 mt-1">Sube briefs, referencias, contratos y más</p>}
          </div>
        ) : (
          files.map(f => (
            <FileRow
              key={f.id}
              file={f}
              projectId={projectId}
              canDelete={isAdmin || f.uploadedById === currentUserId}
              onDelete={id => setFiles(prev => prev.filter(x => x.id !== id))}
            />
          ))
        )}
      </div>
    </div>
  )
}

// tiny inline uuid for queue IDs (no extra dep)
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}
