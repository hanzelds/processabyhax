'use client'

import { useEffect, useRef } from 'react'
import { DocBlockType } from '@/types'
import { BLOCK_LABELS } from './docUtils'

const MENU_ITEMS: DocBlockType[] = [
  'paragraph', 'heading_1', 'heading_2', 'heading_3',
  'bulleted_list', 'numbered_list', 'divider',
  'callout', 'code', 'image', 'child_page',
]

interface Props {
  filter: string
  position: { top: number; left: number }
  onSelect: (type: DocBlockType) => void
  onClose: () => void
}

export function BlockMenu({ filter, position, onSelect, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const lf = filter.toLowerCase()

  const filtered = MENU_ITEMS.filter(type => {
    if (!lf) return true
    const meta = BLOCK_LABELS[type]
    return (
      meta.label.toLowerCase().includes(lf) ||
      meta.shortcut.toLowerCase().includes(lf) ||
      type.includes(lf)
    )
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [onClose])

  if (filtered.length === 0) return null

  // Clamp position so menu stays on screen
  const top = Math.min(position.top, window.innerHeight - 300)
  const left = Math.min(position.left, window.innerWidth - 280)

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 overflow-hidden"
      style={{ top, left }}
    >
      <p className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Bloques</p>
      {filtered.map(type => {
        const meta = BLOCK_LABELS[type]
        return (
          <button
            key={type}
            onMouseDown={e => { e.preventDefault(); onSelect(type) }}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
          >
            <span className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg text-sm font-mono text-slate-600 shrink-0">
              {meta.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{meta.label}</p>
              <p className="text-xs text-slate-400 truncate">{meta.description}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
