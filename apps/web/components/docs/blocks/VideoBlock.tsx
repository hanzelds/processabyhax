'use client'

import { useState, useRef } from 'react'
import { DocBlock } from '@/types'
import { Video, Upload, Loader2 } from 'lucide-react'

interface Props {
  block: DocBlock
  readOnly: boolean
  blockRef: (el: HTMLElement | null) => void
  onUpdate: (updates: Partial<DocBlock['content']>) => void
  onFocus: () => void
}

export function VideoBlock({ block, readOnly, blockRef, onUpdate, onFocus }: Props) {
  const url     = block.content.url     ?? ''
  const caption = block.content.caption ?? ''
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith('video/')) { setError('Solo se aceptan archivos de video'); return }
    if (file.size > 100 * 1024 * 1024) { setError('El video no puede superar 100 MB'); return }
    setUploading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/drive/upload', { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json()
      if (res.ok && data.url) {
        onUpdate({ url: data.url, caption })
      } else {
        setError(data.error ?? 'Error al subir el video')
      }
    } catch { setError('Error de red') }
    finally { setUploading(false) }
  }

  if (!url) {
    return (
      <div ref={el => blockRef(el as HTMLElement)} onFocus={onFocus}>
        <div
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-[#17394f]/40 hover:bg-slate-50 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        >
          {uploading
            ? <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            : <Video className="w-8 h-8 text-slate-300" />
          }
          <p className="text-sm text-slate-500">{uploading ? 'Subiendo…' : 'Arrastra un video o haz clic para seleccionar'}</p>
          <p className="text-xs text-slate-400">MP4, WebM, MOV · máx. 100 MB</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      </div>
    )
  }

  return (
    <div ref={el => blockRef(el as HTMLElement)} onFocus={onFocus} className="my-2 group">
      <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-black">
        <video src={url} controls className="w-full max-h-[500px]" />
        {!readOnly && (
          <button
            onClick={() => onUpdate({ url: '' })}
            className="absolute top-2 right-2 bg-white/90 border border-slate-200 text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
          >
            Cambiar
          </button>
        )}
      </div>
      {(caption || !readOnly) && (
        <div
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onBlur={e => onUpdate({ caption: e.currentTarget.textContent ?? '' })}
          className="text-xs text-slate-400 text-center mt-1.5 outline-none empty:before:content-['Descripción…'] empty:before:text-slate-300"
        >
          {caption}
        </div>
      )}
    </div>
  )
}
