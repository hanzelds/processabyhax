'use client'

import { useEffect, useRef } from 'react'
import { DocBlockType } from '@/types'
import { BLOCK_LABELS } from './docUtils'

const MENU_SECTIONS: { label: string; items: DocBlockType[] }[] = [
  { label: 'Texto', items: ['paragraph', 'heading_1', 'heading_2', 'heading_3'] },
  { label: 'Listas', items: ['bulleted_list', 'numbered_list'] },
  { label: 'Estructura', items: ['divider', 'callout', 'code', 'table', 'toggle', 'quote'] },
  { label: 'Media', items: ['image', 'video', 'embed', 'child_page'] },
]

const ALL_ITEMS: DocBlockType[] = MENU_SECTIONS.flatMap(s => s.items)

interface Props {
  filter: string
  position: { top: number; left: number }
  onSelect: (type: DocBlockType) => void
  onClose: () => void
}

export function BlockMenu({ filter, position, onSelect, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const lf = filter.toLowerCase()

  const filtered = lf
    ? ALL_ITEMS.filter(type => {
        const meta = BLOCK_LABELS[type]
        return meta.label.toLowerCase().includes(lf) || meta.shortcut.toLowerCase().includes(lf) || type.includes(lf)
      })
    : null

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [onClose])

  const isEmpty = filtered ? filtered.length === 0 : false
  if (isEmpty) return null

  const top  = Math.min(position.top, window.innerHeight - 360)
  const left = Math.min(position.left, window.innerWidth - 280)

  function BlockItem({ type }: { type: DocBlockType }) {
    const meta = BLOCK_LABELS[type]
    return (
      <button
        onMouseDown={e => { e.preventDefault(); onSelect(type) }}
        className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-slate-50 transition-colors text-left rounded-lg"
      >
        <span className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg text-sm font-mono text-slate-600 shrink-0">
          {meta.icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 leading-tight">{meta.label}</p>
          <p className="text-[11px] text-slate-400 truncate leading-tight">{meta.description}</p>
        </div>
      </button>
    )
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-2 overflow-hidden max-h-96 overflow-y-auto"
      style={{ top, left }}
    >
      {filtered ? (
        <div className="px-1.5 space-y-0.5">
          {filtered.map(type => <BlockItem key={type} type={type} />)}
        </div>
      ) : (
        MENU_SECTIONS.map(section => (
          <div key={section.label} className="mb-1">
            <p className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{section.label}</p>
            <div className="px-1.5 space-y-0.5">
              {section.items.map(type => <BlockItem key={type} type={type} />)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
