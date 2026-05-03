'use client'

import { useState } from 'react'
import { DocBlock } from '@/types'
import { ImageIcon } from 'lucide-react'

interface Props {
  block: DocBlock
  readOnly: boolean
  blockRef: (el: HTMLElement | null) => void
  onUpdate: (updates: Partial<DocBlock['content']>) => void
  onFocus: () => void
}

export function ImageBlock({ block, readOnly, blockRef, onUpdate, onFocus }: Props) {
  const url     = block.content.url     ?? ''
  const caption = block.content.caption ?? ''
  const [editing, setEditing] = useState(!url)

  return (
    <div ref={el => blockRef(el as HTMLElement)} className="space-y-1" onFocus={onFocus}>
      {url && !editing ? (
        <div className="group relative">
          <img
            src={url}
            alt={caption}
            className="w-full rounded-xl object-cover max-h-[500px]"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          {!readOnly && (
            <button
              onClick={() => setEditing(true)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white text-xs px-2 py-1 rounded-lg"
            >
              Cambiar
            </button>
          )}
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center gap-3">
          <ImageIcon className="w-8 h-8 text-slate-300" />
          <p className="text-sm text-slate-400">Pega la URL de la imagen</p>
          <input
            type="url"
            defaultValue={url}
            placeholder="https://..."
            autoFocus
            onBlur={e => {
              if (e.target.value) { onUpdate({ url: e.target.value }); setEditing(false) }
              else if (url) setEditing(false)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value
                if (val) { onUpdate({ url: val }); setEditing(false) }
              }
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-full max-w-sm border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#17394f]/20"
          />
        </div>
      )}
      {url && (
        <input
          type="text"
          value={caption}
          readOnly={readOnly}
          onChange={e => onUpdate({ caption: e.target.value })}
          placeholder="Añadir caption..."
          className="w-full text-center text-xs text-slate-400 outline-none bg-transparent placeholder:text-slate-200"
        />
      )}
    </div>
  )
}
