'use client'

import { useRef, useEffect } from 'react'
import { DocBlock } from '@/types'
import { placeCursorAtEnd } from '../docUtils'

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

export function QuoteBlock({ block, focused, readOnly, blockRef, onUpdate, onEnter, onBackspaceEmpty, onFocus }: Props) {
  const ref = useRef<HTMLQuoteElement | null>(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (block.content.html ?? '')) {
      ref.current.innerHTML = block.content.html ?? ''
    }
  }, [])

  useEffect(() => {
    if (focused && ref.current) placeCursorAtEnd(ref.current)
  }, [focused])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter() }
    if (e.key === 'Backspace') {
      const text = ref.current?.innerText?.replace(/\n$/, '') ?? ''
      if (!text.trim()) { e.preventDefault(); onBackspaceEmpty() }
    }
  }

  function handleInput() {
    if (ref.current) onUpdate({ html: ref.current.innerHTML })
  }

  return (
    <blockquote
      ref={el => { ref.current = el; blockRef(el) }}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      onFocus={onFocus}
      className="border-l-4 border-slate-300 pl-4 py-0.5 text-slate-600 italic text-base leading-relaxed outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 empty:before:not-italic empty:before:pointer-events-none"
      data-placeholder="Escribe una cita…"
    />
  )
}
