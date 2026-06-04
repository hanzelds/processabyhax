'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { DocBlock } from '@/types'
import { ChevronRight, Plus } from 'lucide-react'
import { placeCursorAtEnd, makeBlock } from '../docUtils'

interface Props {
  block: DocBlock
  focused: boolean
  readOnly: boolean
  blockRef: (el: HTMLElement | null) => void
  onUpdate: (updates: Partial<DocBlock['content']>) => void
  onEnter: () => void
  onBackspaceEmpty: () => void
  onFocus: () => void
}

export function ToggleBlock({ block, focused, readOnly, blockRef, onUpdate, onEnter, onBackspaceEmpty, onFocus }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(block.content.open !== false)
  const children: DocBlock[] = block.content.children ?? []

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (block.content.html ?? '')) {
      ref.current.innerHTML = block.content.html ?? ''
    }
  }, [])

  useEffect(() => {
    if (focused && ref.current) placeCursorAtEnd(ref.current)
  }, [focused])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!open) { setOpen(true); onUpdate({ open: true }) }
      else onEnter()
    }
    if (e.key === 'Backspace') {
      const text = ref.current?.innerText?.replace(/\n$/, '') ?? ''
      if (!text.trim() && children.length === 0) { e.preventDefault(); onBackspaceEmpty() }
    }
  }

  function handleInput() {
    if (ref.current) onUpdate({ html: ref.current.innerHTML })
  }

  function toggleOpen() {
    const next = !open
    setOpen(next)
    onUpdate({ open: next })
  }

  const updateChild = useCallback((childId: string, updates: Partial<DocBlock['content']>) => {
    const next = children.map(c => c.id === childId ? { ...c, content: { ...c.content, ...updates } } : c)
    onUpdate({ children: next })
  }, [children, onUpdate])

  const addChild = useCallback(() => {
    const nb = makeBlock('paragraph')
    onUpdate({ children: [...children, nb] })
  }, [children, onUpdate])

  const deleteChild = useCallback((childId: string) => {
    onUpdate({ children: children.filter(c => c.id !== childId) })
  }, [children, onUpdate])

  return (
    <div ref={el => blockRef(el as HTMLElement)} className="my-0.5">
      {/* Header row */}
      <div className="flex items-start gap-1 group/toggle">
        <button
          onClick={toggleOpen}
          className="mt-[3px] w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shrink-0 rounded"
        >
          <ChevronRight
            className="w-3.5 h-3.5 transition-transform duration-150"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
        </button>
        <div
          ref={ref}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onFocus={onFocus}
          className="flex-1 text-base font-medium text-slate-800 outline-none min-h-[1.5em] leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 empty:before:font-normal empty:before:pointer-events-none"
          data-placeholder="Toggle…"
        />
      </div>

      {/* Children */}
      {open && (
        <div className="ml-6 border-l border-slate-100 pl-3 space-y-0.5 mt-0.5">
          {children.map(child => (
            <ChildParagraph
              key={child.id}
              block={child}
              readOnly={readOnly}
              onUpdate={upd => updateChild(child.id, upd)}
              onDelete={() => deleteChild(child.id)}
            />
          ))}
          {!readOnly && (
            <button
              onClick={addChild}
              className="flex items-center gap-1 text-xs text-slate-300 hover:text-slate-500 transition-colors py-0.5 mt-1"
            >
              <Plus className="w-3 h-3" /> Agregar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Simple inline text editor for toggle children
function ChildParagraph({ block, readOnly, onUpdate, onDelete }: {
  block: DocBlock
  readOnly: boolean
  onUpdate: (u: Partial<DocBlock['content']>) => void
  onDelete: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (block.content.html ?? '')) {
      ref.current.innerHTML = block.content.html ?? ''
    }
  }, [])

  return (
    <div
      ref={ref}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onInput={e => onUpdate({ html: (e.target as HTMLDivElement).innerHTML })}
      onKeyDown={e => {
        if (e.key === 'Backspace') {
          const text = (e.target as HTMLDivElement).innerText?.replace(/\n$/, '') ?? ''
          if (!text.trim()) { e.preventDefault(); onDelete() }
        }
      }}
      className="text-sm text-slate-700 outline-none min-h-[1.25em] leading-relaxed empty:before:content-['Escribe…'] empty:before:text-slate-300 empty:before:pointer-events-none"
    />
  )
}
