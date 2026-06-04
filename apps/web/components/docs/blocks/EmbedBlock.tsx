'use client'

import { useState } from 'react'
import { DocBlock } from '@/types'
import { ExternalLink } from 'lucide-react'

interface Props {
  block: DocBlock
  readOnly: boolean
  blockRef: (el: HTMLElement | null) => void
  onUpdate: (updates: Partial<DocBlock['content']>) => void
  onFocus: () => void
}

type EmbedService = { name: string; iframeUrl: (url: string) => string | null }

const SERVICES: EmbedService[] = [
  {
    name: 'youtube',
    iframeUrl: url => {
      const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
      return m ? `https://www.youtube.com/embed/${m[1]}` : null
    },
  },
  {
    name: 'loom',
    iframeUrl: url => {
      const m = url.match(/loom\.com\/share\/([a-f0-9]+)/)
      return m ? `https://www.loom.com/embed/${m[1]}` : null
    },
  },
  {
    name: 'figma',
    iframeUrl: url =>
      url.includes('figma.com') ? `https://www.figma.com/embed?embed_host=processa&url=${encodeURIComponent(url)}` : null,
  },
  {
    name: 'drive',
    iframeUrl: url => {
      if (!url.includes('drive.google.com')) return null
      const m = url.match(/\/d\/([^/]+)/)
      return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null
    },
  },
]

function detectService(url: string): { service: string; iframeUrl: string } | null {
  for (const s of SERVICES) {
    const iframe = s.iframeUrl(url)
    if (iframe) return { service: s.name, iframeUrl: iframe }
  }
  // Generic fallback — try to embed directly
  try { new URL(url); return { service: 'generic', iframeUrl: url } } catch { return null }
}

export function EmbedBlock({ block, readOnly, blockRef, onUpdate, onFocus }: Props) {
  const url     = block.content.url     ?? ''
  const caption = block.content.caption ?? ''
  const [input, setInput]   = useState(url)
  const [editing, setEditing] = useState(!url)

  const detected = url ? detectService(url) : null

  function handleConfirm() {
    const trimmed = input.trim()
    if (!trimmed) return
    const d = detectService(trimmed)
    onUpdate({ url: trimmed, service: d?.service ?? 'generic' })
    setEditing(false)
  }

  if (editing || !url) {
    return (
      <div ref={el => blockRef(el as HTMLElement)} onFocus={onFocus} className="my-2">
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">Embed</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleConfirm() } }}
              placeholder="Pega una URL de YouTube, Figma, Loom, Google Drive…"
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#17394f] text-slate-700"
            />
            <button
              onClick={handleConfirm}
              className="px-3 py-2 bg-[#17394f] text-white text-sm rounded-lg hover:bg-[#1e4a65] transition-colors shrink-0"
            >
              Insertar
            </button>
          </div>
          <p className="text-[11px] text-slate-400 text-center">
            Soportado: <span className="font-medium">YouTube · Loom · Figma · Google Drive</span> · cualquier URL
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={el => blockRef(el as HTMLElement)} onFocus={onFocus} className="my-2 group">
      <div className="relative rounded-xl overflow-hidden border border-slate-200">
        {detected ? (
          <iframe
            src={detected.iframeUrl}
            className="w-full aspect-video"
            allowFullScreen
            loading="lazy"
            title={caption || 'Embed'}
          />
        ) : (
          <div className="bg-slate-50 p-4 flex items-center gap-3">
            <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#17394f] hover:underline truncate">{url}</a>
          </div>
        )}
        {!readOnly && (
          <button
            onClick={() => { setInput(url); setEditing(true) }}
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
