'use client'

import { useEffect, useRef } from 'react'
import { DocBlock, DocBlockType } from '@/types'
import { BLOCK_LABELS } from './docUtils'

const CONVERTIBLE: DocBlockType[] = [
  'paragraph', 'heading_1', 'heading_2', 'heading_3',
  'bulleted_list', 'numbered_list', 'callout',
]

interface Props {
  block: DocBlock
  position: { top: number; left: number }
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onDuplicate: () => void
  onConvert: (type: DocBlockType) => void
  onClose: () => void
}

export function BlockOptions({ block, position, onMoveUp, onMoveDown, onDelete, onDuplicate, onConvert, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [converting, setConverting] = useRef([false]).current

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [onClose])

  const top = Math.min(position.top, window.innerHeight - 320)
  const left = Math.min(position.left, window.innerWidth - 220)

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-52 bg-white rounded-xl border border-slate-200 shadow-xl py-1 overflow-hidden text-sm"
      style={{ top, left }}
    >
      <button onMouseDown={e => { e.preventDefault(); onMoveUp(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-slate-700">
        <span className="w-4 text-center">↑</span> Mover arriba
      </button>
      <button onMouseDown={e => { e.preventDefault(); onMoveDown(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-slate-700">
        <span className="w-4 text-center">↓</span> Mover abajo
      </button>
      <button onMouseDown={e => { e.preventDefault(); onDuplicate(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-slate-700">
        <span className="w-4 text-center">📋</span> Duplicar
      </button>

      {CONVERTIBLE.includes(block.type) && (
        <>
          <div className="border-t border-slate-100 my-1" />
          <p className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Convertir en</p>
          {CONVERTIBLE.filter(t => t !== block.type).map(type => (
            <button
              key={type}
              onMouseDown={e => { e.preventDefault(); onConvert(type); onClose() }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-slate-600"
            >
              <span className="w-4 text-center text-xs font-mono">{BLOCK_LABELS[type].icon}</span>
              {BLOCK_LABELS[type].label}
            </button>
          ))}
        </>
      )}

      <div className="border-t border-slate-100 my-1" />
      <button onMouseDown={e => { e.preventDefault(); onDelete(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-red-50 text-red-500">
        <span className="w-4 text-center">🗑</span> Eliminar
      </button>
    </div>
  )
}
